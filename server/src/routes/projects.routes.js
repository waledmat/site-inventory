const router = require('express').Router();
const ctrl = require('../controllers/projects.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

router.get('/', auth, ctrl.list);
router.get('/pending-deletions', auth, role('admin'), ctrl.listPendingDeletions);
router.post('/', auth, role('admin', 'superuser'), ctrl.create);
router.get('/:id', auth, ctrl.get);
router.put('/:id', auth, role('admin', 'superuser'), ctrl.update);
router.post('/:id/extend', auth, role('superuser', 'admin'), ctrl.extendDuration);
router.post('/:id/request-deletion', auth, role('admin', 'superuser'), ctrl.requestDeletion);
router.post('/:id/approve-deletion', auth, role('admin'), ctrl.approveDeletion);
router.post('/:id/reject-deletion', auth, role('admin'), ctrl.rejectDeletion);
router.post('/:id/storekeepers', auth, role('admin', 'superuser'), ctrl.assignStorekeeper);
router.delete('/:id/storekeepers/:userId', auth, role('admin', 'superuser'), ctrl.removeStorekeeper);
router.post('/:id/requesters', auth, role('admin', 'superuser'), ctrl.assignRequester);

module.exports = router;
