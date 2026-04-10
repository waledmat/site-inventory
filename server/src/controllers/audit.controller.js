const db = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    const { user_id, entity_type, date_from, date_to, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [], params = [];

    if (user_id) { params.push(user_id); where.push(`a.user_id = $${params.length}`); }
    if (entity_type) { params.push(entity_type); where.push(`a.entity_type = $${params.length}`); }
    if (date_from) { params.push(date_from); where.push(`a.created_at >= $${params.length}`); }
    if (date_to) { params.push(date_to + ' 23:59:59'); where.push(`a.created_at <= $${params.length}`); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countRes = await db.query(`SELECT COUNT(*) FROM audit_log a ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit));
    params.push(offset);
    const { rows } = await db.query(
      `SELECT a.*, u.name as user_name, u.role as user_role,
              CASE
                WHEN a.entity_type = 'material_issue' THEN dn.dn_number
                WHEN a.entity_type = 'material_return' THEN mr.return_number::text
                ELSE NULL
              END as ref_number
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN material_issues mi ON mi.id::text = a.entity_id AND a.entity_type = 'material_issue'
       LEFT JOIN delivery_notes dn ON dn.issue_id = mi.id
       LEFT JOIN material_returns mr ON mr.id::text = a.entity_id AND a.entity_type = 'material_return'
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
};

exports.entityTypes = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type`
    );
    res.json(rows.map(r => r.entity_type));
  } catch (err) { next(err); }
};
