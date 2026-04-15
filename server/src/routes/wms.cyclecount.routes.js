const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/wms.cyclecount.controller');
const pdfSvc = require('../services/pdf.service');
const db = require('../config/db');

const wm = role('warehouse_manager', 'admin', 'superuser');
const wmAll = role('warehouse_manager', 'receiver', 'picker', 'admin', 'superuser');

router.use(auth);

router.get('/',                         wmAll, ctrl.list);
router.post('/',                        wm,    ctrl.create);
router.get('/:id',                      wmAll, ctrl.get);
router.put('/:id/items/:itemId/count',  wmAll, ctrl.recordCount);
router.post('/:id/complete',            wm,    ctrl.complete);
router.post('/:id/cancel',              wm,    ctrl.cancel);

// Count sheet PDF
router.get('/:id/pdf', wmAll, async (req, res) => {
  try {
    const { rows: [cc] } = await db.query(`
      SELECT cc.*, z.name AS zone_name, u.name AS created_by_name
      FROM wms_cycle_counts cc
      LEFT JOIN wms_zones z ON z.id = cc.zone_id
      LEFT JOIN users    u ON u.id  = cc.created_by
      WHERE cc.id = $1
    `, [req.params.id]);
    if (!cc) return res.status(404).json({ error: 'Not found' });

    const { rows: items } = await db.query(`
      SELECT
        cci.expected_qty, cci.counted_qty,
        (cci.counted_qty - cci.expected_qty) AS variance,
        im.item_number, im.description_1, im.uom,
        b.full_code AS bin_code
      FROM wms_cycle_count_items cci
      JOIN wms_item_master im ON im.id = cci.item_master_id
      JOIN wms_bins        b  ON b.id  = cci.bin_id
      WHERE cci.cycle_count_id = $1
      ORDER BY b.full_code, im.item_number
    `, [cc.id]);

    const pdfBuffer = await pdfSvc.generateCycleCountSheet({ ...cc, items });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${cc.count_number}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;
