const router = require('express').Router();
const ctrl = require('../controllers/issues.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', auth, ctrl.list);
router.post('/', auth, role('storekeeper', 'admin', 'superuser'), ctrl.create);
router.get('/:id', auth, ctrl.get);
router.get('/:id/delivery-note', auth, ctrl.deliveryNote);

module.exports = router;
