const bcrypt = require('bcrypt');
const db = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    let { role } = req.query;
    // Storekeepers can only list requesters
    if (req.user.role === 'storekeeper') role = 'requester';
    let q = 'SELECT id, employee_id, name, role, email, phone, position, is_active, notify_email, authorized_by, created_at FROM users';
    const params = [];
    if (role) { q += ' WHERE role = $1'; params.push(role); }
    q += ' ORDER BY name';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, employee_id, role, position, password } = req.body;
    if (!name || !employee_id || !role || !password) return res.status(400).json({ error: 'name, employee_id, role, password required' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, employee_id, role, position, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, employee_id, name, role, position, is_active`,
      [name, employee_id.trim(), role, position || null, hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Employee ID already exists' });
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, employee_id, name, role, email, phone, position, is_active, notify_email, authorized_by FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, role, position, is_active, password } = req.body;
    let hash = null;
    if (password) hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        role = COALESCE($2, role),
        position = COALESCE($3, position),
        is_active = COALESCE($4, is_active),
        password_hash = COALESCE($5, password_hash)
       WHERE id = $6
       RETURNING id, employee_id, name, role, position, is_active`,
      [name, role, position, is_active, hash, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.authorize = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE users SET role = 'requester', authorized_by = $1 WHERE id = $2
       RETURNING id, name, role, email, position`,
      [req.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};
