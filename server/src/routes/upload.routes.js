const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/upload.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/packing-list/template', auth, role('superuser', 'admin'), ctrl.template);
router.post('/packing-list', auth, role('superuser', 'admin'), upload.single('file'), ctrl.validate);
router.post('/packing-list/confirm', auth, role('superuser', 'admin'), ctrl.confirm);

module.exports = router;
