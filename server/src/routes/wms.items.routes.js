const router = require('express').Router();
const ctrl = require('../controllers/wms.items.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const pdfSvc = require('../services/pdf.service');
const db = require('../config/db');

const wmsRoles = role('warehouse_manager', 'receiver', 'picker', 'admin', 'superuser');
const wm = role('warehouse_manager', 'admin');

router.get('/',                      auth, wmsRoles, ctrl.list);
router.post('/',                     auth, wm,       ctrl.create);
router.get('/:id',                   auth, wmsRoles, ctrl.get);
router.put('/:id',                   auth, wm,       ctrl.update);
router.get('/:id/stock',             auth, wmsRoles, ctrl.getStock);
router.get('/:id/transactions',      auth, wm,       ctrl.getTransactions);

// Item label PDF with QR
router.get('/:id/label', auth, wmsRoles, async (req, res) => {
  try {
    const { rows: [item] } = await db.query(
      'SELECT * FROM wms_item_master WHERE id = $1', [req.params.id]
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const pdfBuffer = await pdfSvc.generateItemLabel(item);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="ITEM-${item.item_number}.pdf"` });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate item label' });
  }
});

module.exports = router;
