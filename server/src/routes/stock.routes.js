const router = require('express').Router();
const ctrl = require('../controllers/stock.controller');
const auth = require('../middleware/auth');

router.get('/search', auth, ctrl.search);

module.exports = router;
