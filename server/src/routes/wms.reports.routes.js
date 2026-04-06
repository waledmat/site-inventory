const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/wms.reports.controller');
const pdfSvc = require('../services/pdf.service');
const db = require('../config/db');

const wmAll = role('warehouse_manager', 'receiver', 'picker', 'admin', 'superuser');

router.use(auth);

router.get('/stock-movement',   wmAll, ctrl.stockMovement);
router.get('/grn-history',      wmAll, ctrl.grnHistory);
router.get('/dispatch-history', wmAll, ctrl.dispatchHistory);
router.get('/stock-snapshot',   wmAll, ctrl.stockSnapshot);

// ─── PDF: Stock Movement ─────────────────────────────────────────────────────
router.get('/stock-movement/pdf', wmAll, async (req, res) => {
  try {
    const { from, to, item_master_id, category } = req.query;
    const params = [];
    const conditions = [];
    if (from)           { params.push(from);                conditions.push(`t.created_at >= $${params.length}`); }
    if (to)             { params.push(to + ' 23:59:59');    conditions.push(`t.created_at <= $${params.length}`); }
    if (item_master_id) { params.push(item_master_id);      conditions.push(`t.item_master_id = $${params.length}`); }
    if (category)       { params.push(category);            conditions.push(`im.category = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT t.transaction_type, t.quantity, t.created_at, t.reference_type, t.notes,
             im.item_number, im.description_1, im.category, im.uom,
             b.full_code AS bin_code, u.name AS user_name
      FROM wms_stock_transactions t
      JOIN wms_item_master im ON im.id = t.item_master_id
      LEFT JOIN wms_bins   b  ON b.id  = t.bin_id
      LEFT JOIN users      u  ON u.id  = t.user_id
      ${where}
      ORDER BY t.created_at DESC LIMIT 1000
    `, params);
    const pdfBuffer = await pdfSvc.generateStockMovementReport(rows, { from, to, category });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="stock-movement.pdf"' });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ─── PDF: Stock Snapshot ─────────────────────────────────────────────────────
router.get('/stock-snapshot/pdf', wmAll, async (req, res) => {
  try {
    const { category, low_stock } = req.query;
    const conditions = [];
    const params = [];
    if (category)             { params.push(category); conditions.push(`im.category = $${params.length}`); }
    if (low_stock === 'true') conditions.push('COALESCE(s.total_qty,0) <= im.reorder_point');
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await db.query(`
      SELECT im.item_number, im.description_1, im.category, im.uom, im.reorder_point,
             COALESCE(s.total_qty, 0) AS total_qty,
             CASE WHEN COALESCE(s.total_qty,0) <= im.reorder_point THEN true ELSE false END AS low_stock
      FROM wms_item_master im
      LEFT JOIN wms_stock_summary s ON s.item_master_id = im.id
      ${where}
      ORDER BY im.category, im.item_number
    `, params);
    const pdfBuffer = await pdfSvc.generateStockSnapshotReport(rows, { category });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="stock-snapshot.pdf"' });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
