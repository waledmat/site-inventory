const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const c = require('../controllers/wms.receiving.controller');
const pdfSvc = require('../services/pdf.service');
const db = require('../config/db');

const wmsRoles = role('warehouse_manager', 'receiver', 'admin');

// Purchase Orders
router.get('/po',             auth, wmsRoles, c.listPOs);
router.post('/po',            auth, role('warehouse_manager','admin'), c.createPO);
router.get('/po/:id',         auth, wmsRoles, c.getPO);
router.patch('/po/:id/status',auth, role('warehouse_manager','admin'), c.updatePOStatus);

// GRN
router.get('/grn',            auth, wmsRoles, c.listGRNs);
router.post('/grn',           auth, wmsRoles, c.createGRN);
router.get('/grn/:id',        auth, wmsRoles, c.getGRN);
router.post('/grn/:id/confirm', auth, wmsRoles, c.confirmGRN);

// GRN PDF with QR
router.get('/grn/:id/pdf', auth, wmsRoles, async (req, res) => {
  try {
    const { rows: [grn] } = await db.query(`
      SELECT g.*, s.name AS supplier_name, po.po_number, u.name AS created_by_name
      FROM wms_grn g
      LEFT JOIN wms_suppliers s ON s.id = g.supplier_id
      LEFT JOIN wms_purchase_orders po ON po.id = g.po_id
      LEFT JOIN users u ON u.id = g.created_by
      WHERE g.id = $1
    `, [req.params.id]);
    if (!grn) return res.status(404).json({ error: 'Not found' });

    const { rows: items } = await db.query(`
      SELECT gi.qty_received, gi.condition,
             im.item_number, im.description_1, im.uom
      FROM wms_grn_items gi
      JOIN wms_item_master im ON im.id = gi.item_master_id
      WHERE gi.grn_id = $1 ORDER BY gi.id
    `, [grn.id]);

    const pdfBuffer = await pdfSvc.generateGRNPdf({ ...grn, items });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${grn.grn_number}.pdf"` });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate GRN PDF' });
  }
});

module.exports = router;
