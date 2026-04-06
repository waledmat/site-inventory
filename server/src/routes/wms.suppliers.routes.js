const router = require('express').Router();
const ctrl = require('../controllers/wms.suppliers.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

const wm = role('warehouse_manager', 'admin');

router.get('/',     auth, wm, ctrl.list);
router.post('/',    auth, wm, ctrl.create);
router.get('/:id',  auth, wm, ctrl.get);
router.put('/:id',  auth, wm, ctrl.update);
router.delete('/:id', auth, role('warehouse_manager'), ctrl.deactivate);

module.exports = router;
