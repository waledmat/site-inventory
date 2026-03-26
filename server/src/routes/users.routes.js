const router = require('express').Router();
const ctrl = require('../controllers/users.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', auth, role('admin', 'storekeeper'), ctrl.list);
router.post('/', auth, role('admin'), ctrl.create);
router.get('/:id', auth, role('admin'), ctrl.get);
router.put('/:id', auth, role('admin'), ctrl.update);
router.post('/:id/authorize', auth, role('admin'), ctrl.authorize);

module.exports = router;
