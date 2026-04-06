const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const { active } = req.query;
    let q = 'SELECT * FROM wms_suppliers';
    const params = [];
    if (active === 'true') { q += ' WHERE is_active = true'; }
    else if (active === 'false') { q += ' WHERE is_active = false'; }
    q += ' ORDER BY name';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { code, name, contact_name, contact_email, contact_phone, address, lead_time_days, notes } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
    const { rows } = await db.query(
      `INSERT INTO wms_suppliers (code, name, contact_name, contact_email, contact_phone, address, lead_time_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [code.trim().toUpperCase(), name, contact_name || null, contact_email || null, contact_phone || null, address || null, lead_time_days || 0, notes || null]
    );
    await logAudit(db, req.user.id, 'WMS_SUPPLIER_CREATED', 'wms_supplier', rows[0].id, null, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Supplier code already exists' });
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM wms_suppliers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Supplier not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, contact_name, contact_email, contact_phone, address, lead_time_days, is_active, notes } = req.body;
    const { rows: [old] } = await db.query('SELECT * FROM wms_suppliers WHERE id = $1', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'Supplier not found' });
    const { rows } = await db.query(
      `UPDATE wms_suppliers SET
        name           = COALESCE($1, name),
        contact_name   = COALESCE($2, contact_name),
        contact_email  = COALESCE($3, contact_email),
        contact_phone  = COALESCE($4, contact_phone),
        address        = COALESCE($5, address),
        lead_time_days = COALESCE($6, lead_time_days),
        is_active      = COALESCE($7, is_active),
        notes          = COALESCE($8, notes),
        updated_at     = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, contact_name, contact_email, contact_phone, address, lead_time_days, is_active, notes, req.params.id]
    );
    await logAudit(db, req.user.id, 'WMS_SUPPLIER_UPDATED', 'wms_supplier', req.params.id, old, rows[0]);
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.deactivate = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE wms_suppliers SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, code, name, is_active`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Supplier not found' });
    await logAudit(db, req.user.id, 'WMS_SUPPLIER_DEACTIVATED', 'wms_supplier', req.params.id, null, rows[0]);
    res.json(rows[0]);
  } catch (err) { next(err); }
};
