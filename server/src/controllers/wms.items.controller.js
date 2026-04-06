const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const { q, category, active } = req.query;
    let query = 'SELECT * FROM wms_item_master WHERE 1=1';
    const params = [];
    if (q) {
      params.push(q);
      query += ` AND to_tsvector('english', description_1 || ' ' || COALESCE(description_2,'') || ' ' || item_number) @@ plainto_tsquery('english', $${params.length})`;
    }
    if (category) { params.push(category); query += ` AND category = $${params.length}`; }
    if (active !== undefined) { params.push(active === 'true'); query += ` AND is_active = $${params.length}`; }
    query += ' ORDER BY item_number';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { item_number, description_1, description_2, category, uom, reorder_point, min_stock_level } = req.body;
    if (!item_number || !description_1 || !uom) return res.status(400).json({ error: 'item_number, description_1, uom are required' });
    const { rows } = await db.query(
      `INSERT INTO wms_item_master (item_number, description_1, description_2, category, uom, reorder_point, min_stock_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [item_number.trim(), description_1, description_2 || null, category || null, uom, reorder_point || 0, min_stock_level || 0]
    );
    await logAudit(db, req.user.id, 'WMS_ITEM_CREATED', 'wms_item_master', rows[0].id, null, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Item number already exists' });
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM wms_item_master WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { description_1, description_2, category, uom, reorder_point, min_stock_level, is_active } = req.body;
    const { rows: [old] } = await db.query('SELECT * FROM wms_item_master WHERE id = $1', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'Item not found' });
    const { rows } = await db.query(
      `UPDATE wms_item_master SET
        description_1   = COALESCE($1, description_1),
        description_2   = COALESCE($2, description_2),
        category        = COALESCE($3, category),
        uom             = COALESCE($4, uom),
        reorder_point   = COALESCE($5, reorder_point),
        min_stock_level = COALESCE($6, min_stock_level),
        is_active       = COALESCE($7, is_active),
        updated_at      = NOW()
       WHERE id = $8 RETURNING *`,
      [description_1, description_2, category, uom, reorder_point, min_stock_level, is_active, req.params.id]
    );
    await logAudit(db, req.user.id, 'WMS_ITEM_UPDATED', 'wms_item_master', req.params.id, old, rows[0]);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.getStock = async (req, res, next) => {
  try {
    // Returns bin-level stock for a specific item (available after Phase 2 migrations)
    const { rows } = await db.query(
      `SELECT bs.id, bs.bin_id, b.full_code AS bin_code, bs.qty_on_hand, bs.qty_reserved,
              bs.qty_on_hand - bs.qty_reserved AS qty_available, bs.updated_at
       FROM wms_bin_stock bs
       JOIN wms_bins b ON b.id = bs.bin_id
       WHERE bs.item_master_id = $1
       ORDER BY bs.qty_on_hand DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*, u.name AS user_name
       FROM wms_stock_transactions t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.item_master_id = $1
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};
