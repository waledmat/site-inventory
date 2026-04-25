const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/kpis', auth, role('admin', 'superuser', 'coordinator', 'storekeeper'), ctrl.kpis);
router.get('/cost-summary', auth, role('admin', 'superuser', 'coordinator', 'storekeeper'), ctrl.costSummary);
router.get('/consumption', auth, role('admin', 'superuser', 'coordinator'), ctrl.consumption);
router.get('/summary', auth, role('admin', 'superuser', 'coordinator'), ctrl.summary);
router.get('/project-detail', auth, role('admin', 'superuser', 'coordinator', 'storekeeper'), ctrl.projectDetail);
router.get('/daily-log', auth, role('admin', 'superuser'), ctrl.dailyLog);
router.get('/export', auth, role('admin', 'superuser'), ctrl.exportExcel);
router.get('/packing-list', auth, role('admin', 'superuser', 'storekeeper'), ctrl.packingList);

module.exports = router;
