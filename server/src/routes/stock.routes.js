const router = require('express').Router();
const ctrl = require('../controllers/stock.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.post('/', auth, role('admin', 'superuser'), ctrl.create);
router.get('/search', auth, ctrl.search);
router.get('/lookup', auth, ctrl.lookup);
router.get('/low-stock', auth, ctrl.lowStock);
router.get('/transactions', auth, role('admin', 'superuser'), ctrl.transactions);
router.post('/adjust', auth, role('admin', 'superuser'), ctrl.adjust);
router.put('/:id/reorder-point', auth, role('admin', 'superuser'), ctrl.updateReorderPoint);
router.put('/:id/unit-cost', auth, role('admin', 'superuser'), ctrl.updateUnitCost);

module.exports = router;
