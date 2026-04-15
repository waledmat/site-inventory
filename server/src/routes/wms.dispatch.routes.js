const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/wms.dispatch.controller');
const pdfSvc = require('../services/pdf.service');
const db = require('../config/db');
const path = require('path');
const fs = require('fs');

const wm = role('warehouse_manager', 'admin', 'superuser');
const wmPicker = role('warehouse_manager', 'picker', 'admin', 'superuser');

router.use(auth);

router.get('/',          wmPicker, ctrl.list);
router.post('/',         wm,       ctrl.create);
router.get('/:id',       wmPicker, ctrl.get);
router.post('/:id/confirm',  wm,   ctrl.confirm);
router.post('/:id/dispatch', wm,   ctrl.dispatch);
router.post('/:id/cancel',   wm,   ctrl.cancel);

// PDF download
router.get('/:id/pdf', wmPicker, async (req, res) => {
  try {
    const { rows: [order] } = await db.query(`
      SELECT dsp.*, p.name AS project_name,
             u1.name AS created_by_name, u3.name AS dispatched_by_name
      FROM wms_dispatch_orders dsp
      LEFT JOIN projects p  ON p.id  = dsp.project_id
      LEFT JOIN users   u1 ON u1.id = dsp.created_by
      LEFT JOIN users   u3 ON u3.id = dsp.dispatched_by
      WHERE dsp.id = $1
    `, [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Not found' });

    const { rows: items } = await db.query(`
      SELECT di.qty_requested, di.qty_dispatched,
             im.item_number, im.description_1, im.description_2, im.uom,
             b.full_code AS bin_code
      FROM wms_dispatch_items di
      JOIN wms_item_master im ON im.id = di.item_master_id
      LEFT JOIN wms_bins   b  ON b.id  = di.bin_id
      WHERE di.dispatch_order_id = $1
      ORDER BY di.created_at
    `, [order.id]);

    const pdfBuffer = await pdfSvc.generateDispatchNote({ ...order, items });

    // Save to uploads
    const dir = path.join(__dirname, '../../uploads/dispatch-notes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `${order.order_number}.pdf`;
    fs.writeFileSync(path.join(dir, filename), pdfBuffer);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
