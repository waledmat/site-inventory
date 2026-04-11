const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/upload.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === EXCEL_MIME || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only .xlsx Excel files are allowed'), { status: 400 }));
    }
  },
});

router.get('/packing-list/template', auth, role('superuser', 'admin'), ctrl.template);
router.post('/packing-list', auth, role('superuser', 'admin'), upload.single('file'), ctrl.validate);
router.post('/packing-list/confirm', auth, role('superuser', 'admin'), ctrl.confirm);

module.exports = router;
