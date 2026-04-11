const router = require('express').Router();
const ctrl = require('../controllers/returns.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/pending', auth, role('storekeeper', 'admin', 'superuser'), ctrl.pending);
router.get('/', auth, ctrl.list);
router.post('/', auth, ctrl.create);

module.exports = router;
