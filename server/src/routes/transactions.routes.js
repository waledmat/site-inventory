const router = require('express').Router();
const ctrl = require('../controllers/transactions.controller');
const auth = require('../middleware/auth');

router.get('/:ref', auth, ctrl.getHistory);

module.exports = router;
