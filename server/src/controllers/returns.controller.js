const db = require('../config/db');

exports.pending = async (req, res, next) => {
  try {
    const { project_id, storekeeper_id } = req.query;
    let where = [`ii.quantity_issued > COALESCE((SELECT SUM(r.quantity_returned) FROM material_returns r WHERE r.issue_item_id = ii.id AND r.condition != 'lost'), 0)`];
    const params = [];

    // Storekeeper: scoped to their projects but can see all storekeepers
    if (req.user.role === 'storekeeper') {
      const sk = await db.query('SELECT project_id FROM project_storekeepers WHERE user_id = $1', [req.user.id]);
      const ids = sk.rows.map(x => x.project_id);
      if (!ids.length) return res.json([]);
      params.push(ids); where.push(`i.project_id = ANY($${params.length})`);
    }
    if (project_id) { params.push(project_id); where.push(`i.project_id = $${params.length}`); }
    if (storekeeper_id) { params.push(storekeeper_id); where.push(`i.storekeeper_id = $${params.length}`); }

    const { rows } = await db.query(
      `SELECT ii.id, ii.issue_id, ii.item_number, ii.description_1, ii.uom, ii.quantity_issued,
              COALESCE((SELECT SUM(r.quantity_returned) FROM material_returns r WHERE r.issue_item_id = ii.id AND r.condition != 'lost'), 0) as qty_returned,
              ii.quantity_issued - COALESCE((SELECT SUM(r.quantity_returned) FROM material_returns r WHERE r.issue_item_id = ii.id AND r.condition != 'lost'), 0) as qty_remaining,
              i.issue_date, i.delivery_note_id, i.project_id,
              p.name as project_name,
              sk.name as storekeeper_name, sk.id as storekeeper_user_id,
              rc.name as receiver_name
       FROM issue_items ii
       JOIN material_issues i ON i.id = ii.issue_id
       JOIN projects p ON p.id = i.project_id
       JOIN users sk ON sk.id = i.storekeeper_id
       LEFT JOIN users rc ON rc.id = i.receiver_id
       WHERE ${where.join(' AND ')}
       ORDER BY i.issue_date ASC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { project_id, date_from, date_to } = req.query;
    let where = [], params = [];
    if (project_id) { params.push(project_id); where.push(`r.project_id = $${params.length}`); }
    if (date_from) { params.push(date_from); where.push(`r.return_date >= $${params.length}`); }
    if (date_to) { params.push(date_to); where.push(`r.return_date <= $${params.length}`); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT r.*, ii.description_1, ii.uom, i.delivery_note_id, p.name as project_name, lb.name as logged_by_name
       FROM material_returns r
       JOIN issue_items ii ON ii.id = r.issue_item_id
       JOIN material_issues i ON i.id = ii.issue_id
       JOIN projects p ON p.id = r.project_id
       JOIN users lb ON lb.id = r.logged_by
       ${whereClause} ORDER BY r.return_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const client = await db.connect();
  try {
    const { issue_item_id, quantity_returned, condition, notes } = req.body;
    if (!issue_item_id || !quantity_returned || !condition) {
      return res.status(400).json({ error: 'issue_item_id, quantity_returned, condition required' });
    }

    await client.query('BEGIN');

    // Validate balance
    const { rows: itemRows } = await client.query(
      `SELECT ii.quantity_issued, ii.stock_item_id, i.project_id,
              COALESCE((SELECT SUM(r.quantity_returned) FROM material_returns r WHERE r.issue_item_id = $1 AND r.condition != 'lost'), 0) as already_returned
       FROM issue_items ii JOIN material_issues i ON i.id = ii.issue_id WHERE ii.id = $1`,
      [issue_item_id]
    );
    if (!itemRows[0]) return res.status(404).json({ error: 'Issue item not found' });
    const { quantity_issued, already_returned, stock_item_id, project_id } = itemRows[0];
    if (parseFloat(already_returned) + parseFloat(quantity_returned) > parseFloat(quantity_issued)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Return quantity exceeds issued quantity' });
    }

    const { rows } = await client.query(
      `INSERT INTO material_returns (issue_item_id, project_id, logged_by, quantity_returned, condition, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [issue_item_id, project_id, req.user.id, quantity_returned, condition, notes || null]
    );

    // Update stock
    if (stock_item_id && condition !== 'lost') {
      await client.query(
        `UPDATE stock_items SET qty_returned = qty_returned + $1, qty_pending_return = qty_pending_return - $1, qty_on_hand = qty_on_hand + $1, updated_at = NOW() WHERE id = $2`,
        [quantity_returned, stock_item_id]
      );
    } else if (stock_item_id && condition === 'lost') {
      await client.query(
        `UPDATE stock_items SET qty_pending_return = qty_pending_return - $1, updated_at = NOW() WHERE id = $2`,
        [quantity_returned, stock_item_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};
