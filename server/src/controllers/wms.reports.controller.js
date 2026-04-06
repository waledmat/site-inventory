const db = require('../config/db');

// ─── Stock Movement Report ───────────────────────────────────────────────────
exports.stockMovement = async (req, res) => {
  try {
    const { from, to, item_master_id, category } = req.query;
    const params = [];
    const conditions = [];

    if (from)           { params.push(from);           conditions.push(`t.created_at >= $${params.length}`); }
    if (to)             { params.push(to + ' 23:59:59'); conditions.push(`t.created_at <= $${params.length}`); }
    if (item_master_id) { params.push(item_master_id); conditions.push(`t.item_master_id = $${params.length}`); }
    if (category)       { params.push(category);       conditions.push(`im.category = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT
        t.id, t.transaction_type, t.quantity, t.created_at,
        t.reference_id, t.reference_type, t.notes,
        im.item_number, im.description_1, im.category, im.uom,
        b.full_code AS bin_code,
        u.name AS user_name
      FROM wms_stock_transactions t
      JOIN wms_item_master im ON im.id = t.item_master_id
      LEFT JOIN wms_bins   b  ON b.id  = t.bin_id
      LEFT JOIN users      u  ON u.id  = t.user_id
      ${where}
      ORDER BY t.created_at DESC
      LIMIT 1000
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate stock movement report' });
  }
};

// ─── GRN History Report ──────────────────────────────────────────────────────
exports.grnHistory = async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    const conditions = [];

    if (from) { params.push(from);             conditions.push(`g.created_at >= $${params.length}`); }
    if (to)   { params.push(to + ' 23:59:59'); conditions.push(`g.created_at <= $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT
        g.id, g.grn_number, g.received_date, g.status, g.created_at,
        po.po_number,
        s.name AS supplier_name,
        u.name AS created_by_name,
        SUM(gi.qty_received)::NUMERIC  AS total_qty,
        COUNT(gi.id)::INT              AS line_items
      FROM wms_grn g
      LEFT JOIN wms_purchase_orders po ON po.id = g.po_id
      LEFT JOIN wms_suppliers       s  ON s.id  = po.supplier_id
      LEFT JOIN users               u  ON u.id  = g.created_by
      LEFT JOIN wms_grn_items       gi ON gi.grn_id = g.id
      ${where}
      GROUP BY g.id, po.po_number, s.name, u.name
      ORDER BY g.created_at DESC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate GRN history report' });
  }
};

// ─── Dispatch History Report ─────────────────────────────────────────────────
exports.dispatchHistory = async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const params = [];
    const conditions = [];

    if (from)   { params.push(from);             conditions.push(`dsp.created_at >= $${params.length}`); }
    if (to)     { params.push(to + ' 23:59:59'); conditions.push(`dsp.created_at <= $${params.length}`); }
    if (status) { params.push(status);           conditions.push(`dsp.status = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT
        dsp.id, dsp.order_number, dsp.status, dsp.destination,
        dsp.created_at, dsp.dispatched_at,
        p.name  AS project_name,
        u1.name AS created_by_name,
        u2.name AS dispatched_by_name,
        COUNT(di.id)::INT               AS line_items,
        SUM(di.qty_dispatched)::NUMERIC AS total_dispatched
      FROM wms_dispatch_orders dsp
      LEFT JOIN projects           p  ON p.id  = dsp.project_id
      LEFT JOIN users             u1  ON u1.id = dsp.created_by
      LEFT JOIN users             u2  ON u2.id = dsp.dispatched_by
      LEFT JOIN wms_dispatch_items di ON di.dispatch_order_id = dsp.id
      ${where}
      GROUP BY dsp.id, p.name, u1.name, u2.name
      ORDER BY dsp.created_at DESC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate dispatch history report' });
  }
};

// ─── Stock Snapshot Report ───────────────────────────────────────────────────
exports.stockSnapshot = async (req, res) => {
  try {
    const { category, low_stock } = req.query;
    const conditions = [];
    const params = [];

    if (category)  { params.push(category); conditions.push(`im.category = $${params.length}`); }
    if (low_stock === 'true') conditions.push('s.total_qty <= im.reorder_point');

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT
        im.id, im.item_number, im.description_1, im.category, im.uom,
        im.reorder_point,
        COALESCE(s.total_qty, 0)      AS total_qty,
        COALESCE(s.bin_count, 0)::INT AS bin_count,
        CASE WHEN COALESCE(s.total_qty,0) <= im.reorder_point THEN true ELSE false END AS low_stock
      FROM wms_item_master im
      LEFT JOIN wms_stock_summary s ON s.item_master_id = im.id
      ${where}
      ORDER BY im.category, im.item_number
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate stock snapshot' });
  }
};
