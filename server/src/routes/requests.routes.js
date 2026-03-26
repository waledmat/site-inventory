const router = require('express').Router();
const ctrl = require('../controllers/requests.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', auth, ctrl.list);
router.post('/', auth, role('requester', 'admin', 'superuser'), ctrl.create);
router.get('/:id', auth, ctrl.get);
router.put('/:id/reject', auth, role('storekeeper'), ctrl.reject);
router.put('/:id/escalate', auth, role('requester'), ctrl.escalate);
router.put('/:id/resolve', auth, role('coordinator'), ctrl.resolveEscalation);

module.exports = router;
