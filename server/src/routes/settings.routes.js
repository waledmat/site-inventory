const router = require('express').Router();
const ctrl = require('../controllers/settings.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', auth, role('admin'), ctrl.get);
router.put('/', auth, role('admin'), ctrl.update);

module.exports = router;
