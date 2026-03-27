const router = require('express').Router();
const ctrl = require('../controllers/audit.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', auth, role('admin', 'superuser'), ctrl.list);
router.get('/entity-types', auth, role('admin', 'superuser'), ctrl.entityTypes);

module.exports = router;
