const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const c = require('../controllers/wms.inventory.controller');

const wmsRoles = role('warehouse_manager', 'receiver', 'picker', 'admin', 'superuser');

router.get('/stats',           auth, wmsRoles, c.getDashboardStats);
router.get('/analytics',       auth, wmsRoles, c.getDashboardAnalytics);
router.get('/',                auth, wmsRoles, c.listStock);
router.get('/:itemId/bins',    auth, wmsRoles, c.getBinStock);
router.post('/adjust',         auth, role('warehouse_manager','admin','superuser'), c.adjust);

module.exports = router;
