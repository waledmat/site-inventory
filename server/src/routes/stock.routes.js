const router = require('express').Router();
const ctrl = require('../controllers/stock.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/search', auth, ctrl.search);
router.get('/low-stock', auth, ctrl.lowStock);
router.get('/transactions', auth, role('admin', 'superuser'), ctrl.transactions);
router.post('/adjust', auth, role('admin', 'superuser'), ctrl.adjust);
router.put('/:id/reorder-point', auth, role('admin', 'superuser'), ctrl.updateReorderPoint);

module.exports = router;
