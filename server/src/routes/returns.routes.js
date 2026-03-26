const router = require('express').Router();
const ctrl = require('../controllers/returns.controller');
const auth = require('../middleware/auth');

router.get('/pending', auth, ctrl.pending);
router.get('/', auth, ctrl.list);
router.post('/', auth, ctrl.create);

module.exports = router;
