const db = require('../config/db');
const { logAudit } = require('../utils/audit');

// ── Purchase Orders ───────────────────────────────────────────────────────────

exports.listPOs = async (req, res, next) => {
  try {
    const { status } = req.query;
    let q = `SELECT po.*, s.name AS supplier_name,
               u.name AS created_by_name,
               (SELECT COUNT(*) FROM wms_po_items WHERE po_id = po.id) AS item_count
             FROM wms_purchase_orders po
             JOIN wms_suppliers s ON s.id = po.supplier_id
             LEFT JOIN users u ON u.id = po.created_by
             WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND po.status = $${params.length}`; }
    q += ' ORDER BY po.created_at DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createPO = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { supplier_id, expected_date, notes, items } = req.body;
    if (!supplier_id || !items?.length)
      return res.status(400).json({ error: 'supplier_id and items are required' });

    const poNum = 'PO-' + String(await nextSeq(client, 'wms_po_seq')).padStart(6, '0');
    const { rows: [po] } = await client.query(
      `INSERT INTO wms_purchase_orders (po_number, supplier_id, expected_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [poNum, supplier_id, expected_date || null, notes || null, req.user.id]
    );

    for (const it of items) {
      await client.query(
        `INSERT INTO wms_po_items (po_id, item_master_id, qty_ordered, unit_cost, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [po.id, it.item_master_id, it.qty_ordered, it.unit_cost || null, it.notes || null]
      );
    }

    await logAudit(client, req.user.id, 'WMS_PO_CREATED', 'wms_purchase_order', po.id, null, po);
    await client.query('COMMIT');
    res.status(201).json(po);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};

exports.getPO = async (req, res, next) => {
  try {
    const { rows: [po] } = await db.query(
      `SELECT po.*, s.name AS supplier_name
       FROM wms_purchase_orders po JOIN wms_suppliers s ON s.id = po.supplier_id
       WHERE po.id = $1`, [req.params.id]
    );
    if (!po) return res.status(404).json({ error: 'PO not found' });

    const { rows: items } = await db.query(
      `SELECT pi.*, im.item_number, im.description_1, im.uom
       FROM wms_po_items pi JOIN wms_item_master im ON im.id = pi.item_master_id
       WHERE pi.po_id = $1 ORDER BY im.item_number`,
      [req.params.id]
    );
    res.json({ ...po, items });
  } catch (err) { next(err); }
};

exports.updatePOStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['draft','sent','cancelled'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    const { rows: [old] } = await db.query('SELECT status FROM wms_purchase_orders WHERE id=$1', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'PO not found' });
    const { rows: [po] } = await db.query(
      `UPDATE wms_purchase_orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    await logAudit(db, req.user.id, 'WMS_PO_STATUS_CHANGED', 'wms_purchase_order', req.params.id, { status: old.status }, { status: po.status });
    res.json(po);
  } catch (err) { next(err); }
};

// ── GRN ───────────────────────────────────────────────────────────────────────

exports.listGRNs = async (req, res, next) => {
  try {
    const { status } = req.query;
    let q = `SELECT g.*, s.name AS supplier_name, u.name AS created_by_name,
               (SELECT COUNT(*) FROM wms_grn_items WHERE grn_id = g.id) AS item_count
             FROM wms_grn g
             JOIN wms_suppliers s ON s.id = g.supplier_id
             LEFT JOIN users u ON u.id = g.created_by
             WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND g.status = $${params.length}`; }
    q += ' ORDER BY g.created_at DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createGRN = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { po_id, supplier_id, received_date, notes, items } = req.body;
    if (!supplier_id || !items?.length)
      return res.status(400).json({ error: 'supplier_id and items are required' });

    const grnNum = 'GRN-' + String(await nextSeq(client, 'wms_grn_seq')).padStart(6, '0');
    const { rows: [grn] } = await client.query(
      `INSERT INTO wms_grn (grn_number, po_id, supplier_id, received_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [grnNum, po_id || null, supplier_id, received_date || null, notes || null, req.user.id]
    );

    for (const it of items) {
      await client.query(
        `INSERT INTO wms_grn_items (grn_id, po_item_id, item_master_id, qty_received, condition, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [grn.id, it.po_item_id || null, it.item_master_id, it.qty_received, it.condition || 'good', it.notes || null]
      );
    }

    await logAudit(client, req.user.id, 'WMS_GRN_CREATED', 'wms_grn', grn.id, null, grn);
    await client.query('COMMIT');
    res.status(201).json(grn);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};

exports.getGRN = async (req, res, next) => {
  try {
    const { rows: [grn] } = await db.query(
      `SELECT g.*, s.name AS supplier_name
       FROM wms_grn g JOIN wms_suppliers s ON s.id = g.supplier_id
       WHERE g.id = $1`, [req.params.id]
    );
    if (!grn) return res.status(404).json({ error: 'GRN not found' });

    const { rows: items } = await db.query(
      `SELECT gi.*, im.item_number, im.description_1, im.uom
       FROM wms_grn_items gi JOIN wms_item_master im ON im.id = gi.item_master_id
       WHERE gi.grn_id = $1 ORDER BY im.item_number`,
      [req.params.id]
    );
    res.json({ ...grn, items });
  } catch (err) { next(err); }
};

exports.confirmGRN = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [grn] } = await client.query(
      `SELECT * FROM wms_grn WHERE id = $1 FOR UPDATE`, [req.params.id]
    );
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    if (grn.status === 'confirmed') return res.status(409).json({ error: 'GRN already confirmed' });

    // Update status
    await client.query(
      `UPDATE wms_grn SET status='confirmed' WHERE id=$1`, [grn.id]
    );

    // Get all GRN items
    const { rows: items } = await client.query(
      `SELECT * FROM wms_grn_items WHERE grn_id = $1`, [grn.id]
    );

    // Create putaway tasks for each item
    for (const item of items) {
      await client.query(
        `INSERT INTO wms_putaway_tasks (grn_item_id, item_master_id, qty_to_putaway)
         VALUES ($1,$2,$3)`,
        [item.id, item.item_master_id, item.qty_received]
      );
    }

    // Update PO status if linked
    if (grn.po_id) {
      // Update po_items.qty_received
      for (const item of items) {
        if (item.po_item_id) {
          await client.query(
            `UPDATE wms_po_items SET qty_received = qty_received + $1 WHERE id = $2`,
            [item.qty_received, item.po_item_id]
          );
        }
      }
      // Check if PO fully received
      const { rows: [poCheck] } = await client.query(
        `SELECT COUNT(*) FILTER (WHERE qty_received < qty_ordered) AS outstanding
         FROM wms_po_items WHERE po_id = $1`,
        [grn.po_id]
      );
      const newStatus = parseInt(poCheck.outstanding) === 0 ? 'received' : 'partial';
      await client.query(
        `UPDATE wms_purchase_orders SET status=$1, updated_at=NOW() WHERE id=$2`,
        [newStatus, grn.po_id]
      );
    }

    await logAudit(client, req.user.id, 'WMS_GRN_CONFIRMED', 'wms_grn', grn.id, { status: 'draft' }, { status: 'confirmed', putaway_tasks: items.length });
    await client.query('COMMIT');
    res.json({ message: 'GRN confirmed', putaway_tasks_created: items.length });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};

// Helper: get next sequence value
async function nextSeq(client, seqName) {
  const { rows } = await client.query(`SELECT nextval($1) AS val`, [seqName]);
  return rows[0].val;
}
