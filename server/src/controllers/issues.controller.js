const db = require('../config/db');
const pdfService = require('../services/pdf.service');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/delivery-notes');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

exports.list = async (req, res, next) => {
  try {
    const { project_id, date_from, date_to } = req.query;
    let where = [], params = [];

    if (req.user.role === 'storekeeper') {
      const sk = await db.query('SELECT project_id FROM project_storekeepers WHERE user_id = $1', [req.user.id]);
      const ids = sk.rows.map(x => x.project_id);
      if (!ids.length) return res.json([]);
      params.push(ids); where.push(`i.project_id = ANY($${params.length})`);
    }
    if (project_id) { params.push(project_id); where.push(`i.project_id = $${params.length}`); }
    if (date_from) { params.push(date_from); where.push(`i.issue_date >= $${params.length}`); }
    if (date_to) { params.push(date_to); where.push(`i.issue_date <= $${params.length}`); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT i.*, p.name as project_name,
              sk.name as storekeeper_name, rc.name as receiver_name,
              (SELECT COUNT(*) FROM issue_items ii WHERE ii.issue_id = i.id) as item_count
       FROM material_issues i
       JOIN projects p ON p.id = i.project_id
       JOIN users sk ON sk.id = i.storekeeper_id
       LEFT JOIN users rc ON rc.id = i.receiver_id
       ${whereClause} ORDER BY i.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const client = await db.connect();
  try {
    const { request_id, project_id, receiver_id, items } = req.body;
    if (!project_id || !items?.length) return res.status(400).json({ error: 'project_id and items required' });

    await client.query('BEGIN');

    // Generate delivery note ID
    const seq = await client.query(`SELECT nextval('dn_seq') as n`);
    const dn_id = `DN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(seq.rows[0].n).padStart(4,'0')}`;

    const issRes = await client.query(
      `INSERT INTO material_issues (request_id, project_id, storekeeper_id, receiver_id, delivery_note_id, source)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [request_id || null, project_id, req.user.id, receiver_id || null, dn_id, request_id ? 'request' : 'excel']
    );
    const issue = issRes.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO issue_items (issue_id, stock_item_id, item_number, description_1, description_2, uom, quantity_issued)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [issue.id, item.stock_item_id || null, item.item_number || null, item.description_1, item.description_2 || null, item.uom, item.quantity_issued]
      );
      // Update stock
      if (item.stock_item_id) {
        await client.query(
          `UPDATE stock_items SET qty_on_hand = qty_on_hand - $1, qty_issued = qty_issued + $1, qty_pending_return = qty_pending_return + $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity_issued, item.stock_item_id]
        );
      }
    }

    if (request_id) {
      await client.query(`UPDATE material_requests SET status = 'issued', updated_at = NOW() WHERE id = $1`, [request_id]);
    }

    await client.query('COMMIT');

    // Generate PDF
    const issueData = await getIssueData(issue.id);
    const pdfBuffer = await pdfService.generateDeliveryNote(issueData);
    fs.writeFileSync(path.join(UPLOAD_DIR, `${dn_id}.pdf`), pdfBuffer);

    res.status(201).json({ ...issue, delivery_note_id: dn_id });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};

exports.get = async (req, res, next) => {
  try {
    const data = await getIssueData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Issue not found' });
    res.json(data);
  } catch (err) { next(err); }
};

exports.deliveryNote = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT delivery_note_id FROM material_issues WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Issue not found' });
    const filePath = path.join(UPLOAD_DIR, `${rows[0].delivery_note_id}.pdf`);
    if (!fs.existsSync(filePath)) {
      // Regenerate
      const data = await getIssueData(req.params.id);
      const buf = await pdfService.generateDeliveryNote(data);
      fs.writeFileSync(filePath, buf);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${rows[0].delivery_note_id}.pdf"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
};

async function getIssueData(id) {
  const { rows } = await db.query(
    `SELECT i.*, p.name as project_name,
            sk.name as storekeeper_name, sk.id as storekeeper_id_val,
            rc.name as receiver_name, rc.id as receiver_id_val
     FROM material_issues i
     JOIN projects p ON p.id = i.project_id
     JOIN users sk ON sk.id = i.storekeeper_id
     LEFT JOIN users rc ON rc.id = i.receiver_id
     WHERE i.id = $1`, [id]
  );
  if (!rows[0]) return null;
  const items = await db.query('SELECT * FROM issue_items WHERE issue_id = $1', [id]);
  return { ...rows[0], items: items.rows };
}
