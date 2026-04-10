const db = require('../config/db');
const { logAudit, logStockTransaction } = require('../utils/audit');

exports.create = async (req, res, next) => {
  try {
    const { project_id, item_number, category, description_1, description_2, uom, qty_on_hand } = req.body;
    if (!project_id || !description_1 || !uom) {
      return res.status(400).json({ error: 'project_id, description_1, and uom are required' });
    }
    const qty = parseFloat(qty_on_hand) || 0;
    if (qty < 0) return res.status(400).json({ error: 'qty_on_hand cannot be negative' });

    const { rows } = await db.query(
      `INSERT INTO stock_items (project_id, item_number, category, description_1, description_2, uom, qty_on_hand)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_id, item_number) DO UPDATE
         SET description_1=$4, description_2=$5, uom=$6, qty_on_hand=$7, updated_at=NOW()
       RETURNING *`,
      [project_id, item_number || null, category || null, description_1, description_2 || null, uom, qty]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

exports.search = async (req, res, next) => {
  try {
    const { q = '', project_id, category, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = [];

    // scope by role
    if (req.user.role === 'storekeeper') {
      const sk = await db.query(
        'SELECT project_id FROM project_storekeepers WHERE user_id = $1',
        [req.user.id]
      );
      const ids = sk.rows.map(r => r.project_id);
      if (!ids.length) return res.json({ rows: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      params.push(ids);
      where.push(`s.project_id = ANY($${params.length})`);
    }

    if (project_id) { params.push(project_id); where.push(`s.project_id = $${params.length}`); }
    if (category) { params.push(category); where.push(`s.category = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(s.item_number ILIKE $${params.length} OR s.description_1 ILIKE $${params.length} OR s.description_2 ILIKE $${params.length})`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM stock_items s JOIN projects p ON p.id = s.project_id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);
    const { rows } = await db.query(
      `SELECT s.*, p.name as project_name,
              CASE WHEN s.reorder_point > 0 AND s.qty_on_hand <= s.reorder_point THEN true ELSE false END as is_low_stock
       FROM stock_items s
       JOIN projects p ON p.id = s.project_id
       ${whereClause} ORDER BY s.description_1 LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};

exports.lowStock = async (req, res, next) => {
  try {
    const { project_id } = req.query;
    let where = [`s.reorder_point > 0 AND s.qty_on_hand <= s.reorder_point`];
    const params = [];

    if (req.user.role === 'storekeeper') {
      const sk = await db.query('SELECT project_id FROM project_storekeepers WHERE user_id = $1', [req.user.id]);
      const ids = sk.rows.map(r => r.project_id);
      if (!ids.length) return res.json([]);
      params.push(ids);
      where.push(`s.project_id = ANY($${params.length})`);
    }
    if (project_id) { params.push(project_id); where.push(`s.project_id = $${params.length}`); }

    const { rows } = await db.query(
      `SELECT s.*, p.name as project_name
       FROM stock_items s
       JOIN projects p ON p.id = s.project_id
       WHERE ${where.join(' AND ')}
       ORDER BY (s.qty_on_hand / NULLIF(s.reorder_point, 0)) ASC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.adjust = async (req, res, next) => {
  const client = await db.connect();
  try {
    const { stock_item_id, adjustment, reason } = req.body;
    if (!stock_item_id || adjustment === undefined || adjustment === null) {
      return res.status(400).json({ error: 'stock_item_id and adjustment are required' });
    }
    const adj = parseFloat(adjustment);
    if (isNaN(adj) || adj === 0) {
      return res.status(400).json({ error: 'adjustment must be a non-zero number' });
    }

    await client.query('BEGIN');

    const { rows: before } = await client.query('SELECT * FROM stock_items WHERE id = $1', [stock_item_id]);
    if (!before[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Stock item not found' }); }

    const oldQty = parseFloat(before[0].qty_on_hand);
    const newQty = oldQty + adj;

    if (newQty < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Adjustment would result in negative stock (${oldQty} + ${adj} = ${newQty})` });
    }

    const { rows } = await client.query(
      `UPDATE stock_items SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newQty, stock_item_id]
    );

    await logStockTransaction(client, stock_item_id, 'adjustment', adj, null, 'adjustment', req.user.id, reason || null);
    await logAudit(client, req.user.id, 'STOCK_ADJUSTED', 'stock_item', stock_item_id,
      { qty_on_hand: oldQty },
      { qty_on_hand: newQty, adjustment: adj, reason }
    );

    await client.query('COMMIT');
    res.json({ ...rows[0], old_qty: oldQty, new_qty: newQty, adjustment: adj });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};

exports.updateReorderPoint = async (req, res, next) => {
  try {
    const { reorder_point, min_quantity } = req.body;
    const { rows } = await db.query(
      `UPDATE stock_items SET reorder_point = $1, min_quantity = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [reorder_point || 0, min_quantity || 0, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Stock item not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.transactions = async (req, res, next) => {
  try {
    const { stock_item_id, type, date_from, date_to, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [], params = [];

    if (stock_item_id) { params.push(stock_item_id); where.push(`t.stock_item_id = $${params.length}`); }
    if (type) { params.push(type); where.push(`t.transaction_type = $${params.length}`); }
    if (date_from) { params.push(date_from); where.push(`t.created_at >= $${params.length}`); }
    if (date_to) { params.push(date_to + ' 23:59:59'); where.push(`t.created_at <= $${params.length}`); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const countRes = await db.query(`SELECT COUNT(*) FROM stock_transactions t ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);
    const { rows } = await db.query(
      `SELECT t.*, s.item_number, s.description_1, s.uom, p.name as project_name, u.name as user_name
       FROM stock_transactions t
       LEFT JOIN stock_items s ON s.id = t.stock_item_id
       LEFT JOIN projects p ON p.id = s.project_id
       LEFT JOIN users u ON u.id = t.user_id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};
