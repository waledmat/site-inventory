const db = require('../config/db');

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
      if (!ids.length) return res.json([]);
      params.push(ids);
      where.push(`project_id = ANY($${params.length})`);
    }

    if (project_id) { params.push(project_id); where.push(`project_id = $${params.length}`); }
    if (category) { params.push(category); where.push(`category = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(item_number ILIKE $${params.length} OR description_1 ILIKE $${params.length} OR description_2 ILIKE $${params.length})`);
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
      `SELECT s.*, p.name as project_name FROM stock_items s
       JOIN projects p ON p.id = s.project_id
       ${whereClause} ORDER BY s.description_1 LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};
