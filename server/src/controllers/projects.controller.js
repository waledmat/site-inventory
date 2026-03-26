const db = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    let q, params = [];
    if (req.user.role === 'storekeeper') {
      q = `SELECT p.* FROM projects p
           JOIN project_storekeepers ps ON ps.project_id = p.id
           WHERE ps.user_id = $1 ORDER BY p.name`;
      params = [req.user.id];
    } else if (req.user.role === 'requester') {
      q = `SELECT p.* FROM projects p
           JOIN project_requesters pr ON pr.project_id = p.id
           WHERE pr.user_id = $1 AND p.is_active = true ORDER BY p.name`;
      params = [req.user.id];
    } else {
      q = 'SELECT * FROM projects WHERE is_active = true ORDER BY name';
    }
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { project_number, name, location, start_date, end_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name required' });
    const { rows } = await db.query(
      `INSERT INTO projects (project_number, name, location, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [project_number || null, name, location || null, start_date || null, end_date || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });

    const sk = await db.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN project_storekeepers ps ON ps.user_id = u.id
       WHERE ps.project_id = $1`, [req.params.id]
    );
    res.json({ ...rows[0], storekeepers: sk.rows });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { project_number, name, location, start_date, end_date, is_active } = req.body;
    const { rows } = await db.query(
      `UPDATE projects SET
        project_number = COALESCE($1, project_number),
        name = COALESCE($2, name),
        location = COALESCE($3, location),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [project_number, name, location, start_date, end_date, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.extendDuration = async (req, res, next) => {
  try {
    const { new_end_date, reason } = req.body;
    if (!new_end_date) return res.status(400).json({ error: 'new_end_date required' });
    const proj = await db.query('SELECT end_date FROM projects WHERE id = $1', [req.params.id]);
    if (!proj.rows[0]) return res.status(404).json({ error: 'Project not found' });
    const old_end_date = proj.rows[0].end_date;
    await db.query('UPDATE projects SET end_date = $1 WHERE id = $2', [new_end_date, req.params.id]);
    await db.query(
      `INSERT INTO project_extensions (project_id, extended_by, old_end_date, new_end_date, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, req.user.id, old_end_date, new_end_date, reason || null]
    );
    res.json({ message: 'Project duration extended', old_end_date, new_end_date });
  } catch (err) { next(err); }
};

exports.assignStorekeeper = async (req, res, next) => {
  try {
    const { user_id } = req.body;
    await db.query(
      'INSERT INTO project_storekeepers (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, user_id]
    );
    res.json({ message: 'Storekeeper assigned' });
  } catch (err) { next(err); }
};

exports.removeStorekeeper = async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM project_storekeepers WHERE project_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );
    res.json({ message: 'Storekeeper removed' });
  } catch (err) { next(err); }
};

exports.assignRequester = async (req, res, next) => {
  try {
    const { user_id } = req.body;
    await db.query(
      'INSERT INTO project_requesters (project_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, user_id]
    );
    res.json({ message: 'Requester assigned' });
  } catch (err) { next(err); }
};
