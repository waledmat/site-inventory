const router = require('express').Router();
const ctrl = require('../controllers/wms.locations.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const pdfSvc = require('../services/pdf.service');
const db = require('../config/db');

const wmsRoles = role('warehouse_manager', 'receiver', 'picker', 'admin');
const wm = role('warehouse_manager', 'admin');

router.get('/zones',          auth, wmsRoles, ctrl.listZones);
router.post('/zones',         auth, wm,       ctrl.createZone);

router.get('/racks',          auth, wmsRoles, ctrl.listRacks);
router.post('/racks',         auth, wm,       ctrl.createRack);

router.get('/shelves',        auth, wmsRoles, ctrl.listShelves);
router.post('/shelves',       auth, wm,       ctrl.createShelf);

router.get('/bins',           auth, wmsRoles, ctrl.listBins);
router.post('/bins',          auth, wm,       ctrl.createBin);
router.get('/bins/:id/stock', auth, wmsRoles, ctrl.getBinStock);

// Bin label PDF with QR
router.get('/bins/:id/label', auth, wmsRoles, async (req, res) => {
  try {
    const { rows: [bin] } = await db.query(`
      SELECT b.*, b.full_code,
             z.name AS zone_name, z.code AS zone_code,
             r.code AS rack_code,
             s.code AS shelf_code
      FROM wms_bins b
      JOIN wms_shelves s ON s.id = b.shelf_id
      JOIN wms_racks   r ON r.id = s.rack_id
      JOIN wms_zones   z ON z.id = r.zone_id
      WHERE b.id = $1
    `, [req.params.id]);
    if (!bin) return res.status(404).json({ error: 'Bin not found' });

    const pdfBuffer = await pdfSvc.generateBinLabel(bin);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="BIN-${bin.full_code}.pdf"` });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate bin label' });
  }
});

module.exports = router;
