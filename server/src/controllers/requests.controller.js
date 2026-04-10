const db = require('../config/db');
const { nextRef } = require('../utils/sequences');

exports.list = async (req, res, next) => {
  try {
    const { status, project_id } = req.query;
    let where = [], params = [];

    if (req.user.role === 'requester') {
      params.push(req.user.id); where.push(`r.requester_id = $${params.length}`);
    } else if (req.user.role === 'storekeeper') {
      const sk = await db.query('SELECT project_id FROM project_storekeepers WHERE user_id = $1', [req.user.id]);
      const ids = sk.rows.map(x => x.project_id);
      if (!ids.length) return res.json([]);
      params.push(ids); where.push(`r.project_id = ANY($${params.length})`);
    } else if (req.user.role === 'coordinator') {
      where.push(`r.status IN ('escalated')`);
    }

    if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
    if (project_id) { params.push(project_id); where.push(`r.project_id = $${params.length}`); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT r.*, r.request_number, p.name as project_name,
              u.name as requester_name, u.position as requester_position,
              (SELECT COUNT(*) FROM request_items ri WHERE ri.request_id = r.id) as item_count
       FROM material_requests r
       JOIN projects p ON p.id = r.project_id
       JOIN users u ON u.id = r.requester_id
       ${whereClause} ORDER BY r.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const client = await db.connect();
  try {
    const { project_id, items, notes } = req.body;
    if (!project_id || !items?.length) return res.status(400).json({ error: 'project_id and items required' });

    // Validate items have positive quantities
    for (const item of items) {
      if (!item.quantity_requested || parseFloat(item.quantity_requested) <= 0) {
        return res.status(400).json({ error: 'All items must have a quantity greater than 0' });
      }
    }

    // Requester must be assigned to the target project
    if (req.user.role === 'requester') {
      const assigned = await db.query(
        'SELECT 1 FROM project_requesters WHERE user_id = $1 AND project_id = $2',
        [req.user.id, project_id]
      );
      if (!assigned.rows.length) return res.status(403).json({ error: 'Not assigned to this project' });
    }

    // Verify project exists
    const proj = await db.query('SELECT 1 FROM projects WHERE id = $1', [project_id]);
    if (!proj.rows.length) return res.status(400).json({ error: 'Project not found' });

    await client.query('BEGIN');
    const request_number = await nextRef(client, 'req_seq', 'req_seq_year', 'REQ');
    const req_res = await client.query(
      `INSERT INTO material_requests (project_id, requester_id, notes, request_number) VALUES ($1,$2,$3,$4) RETURNING *`,
      [project_id, req.user.id, notes || null, request_number]
    );
    const request = req_res.rows[0];

    for (const item of items) {
      let desc1 = item.description_1 || null;
      let desc2 = item.description_2 || null;
      let uom   = item.uom   || null;
      let itemNo = item.item_number || null;

      // Always pull authoritative values from stock_items when a stock_item_id is provided
      if (item.stock_item_id) {
        const { rows: si } = await client.query(
          'SELECT description_1, description_2, uom, item_number FROM stock_items WHERE id = $1',
          [item.stock_item_id]
        );
        if (si[0]) {
          desc1  = si[0].description_1;
          desc2  = si[0].description_2 || null;
          uom    = si[0].uom;
          itemNo = si[0].item_number || null;
        }
      }

      await client.query(
        `INSERT INTO request_items (request_id, stock_item_id, item_number, description_1, description_2, uom, quantity_requested)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [request.id, item.stock_item_id || null, itemNo, desc1, desc2, uom, item.quantity_requested]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(request);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};

exports.get = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, p.name as project_name, u.name as requester_name, u.position as requester_position
       FROM material_requests r
       JOIN projects p ON p.id = r.project_id
       JOIN users u ON u.id = r.requester_id
       WHERE r.id = $1`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Request not found' });
    const items = await db.query(
      `SELECT ri.*, s.qty_on_hand
       FROM request_items ri
       LEFT JOIN stock_items s ON s.id = ri.stock_item_id
       WHERE ri.request_id = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], items: items.rows });
  } catch (err) { next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    const { rejection_reason } = req.body;
    const { rows } = await db.query(
      `UPDATE material_requests SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 AND status IN ('pending', 'escalated') RETURNING *`,
      [rejection_reason || null, req.params.id]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Request not found or cannot be rejected in its current status' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

exports.escalate = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const { rows: rrows } = await db.query(
      `UPDATE material_requests SET status = 'escalated', updated_at = NOW()
       WHERE id = $1 AND requester_id = $2 AND status = 'pending' RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rrows[0]) return res.status(404).json({ error: 'Request not found or cannot be escalated' });

    const coord = await db.query(`SELECT id FROM users WHERE role = 'coordinator' AND is_active = true LIMIT 1`);
    await db.query(
      `INSERT INTO escalations (request_id, requester_id, coordinator_id, notes)
       VALUES ($1,$2,$3,$4)`,
      [req.params.id, req.user.id, coord.rows[0]?.id || null, notes || null]
    );
    res.json(rrows[0]);
  } catch (err) { next(err); }
};

exports.resolveEscalation = async (req, res, next) => {
  try {
    const { resolution } = req.body;
    await db.query(
      `UPDATE escalations SET status = 'resolved', resolution = $1, resolved_at = NOW()
       WHERE request_id = $2`,
      [resolution || null, req.params.id]
    );
    await db.query(
      `UPDATE material_requests SET status = 'pending', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Escalation resolved' });
  } catch (err) { next(err); }
};
