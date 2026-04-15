const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const c = require('../controllers/wms.putaway.controller');

const wmsRoles = role('warehouse_manager', 'receiver', 'picker', 'admin', 'superuser');

router.get('/',          auth, wmsRoles, c.listTasks);
router.post('/:id/complete', auth, wmsRoles, c.completeTask);

module.exports = router;
