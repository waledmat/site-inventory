const router = require('express').Router();
const ctrl = require('../controllers/users.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const multer = require('multer');

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === EXCEL_MIME || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only .xlsx Excel files are allowed'), { status: 400 }));
    }
  },
});

// Bulk import routes must come BEFORE /:id to avoid Express treating 'bulk-import' as an id param
router.get('/bulk-import/template', auth, role('admin'), ctrl.templateUsers);
router.post('/bulk-import/validate', auth, role('admin'), upload.single('file'), ctrl.validateImport);
router.post('/bulk-import/confirm',  auth, role('admin'), ctrl.confirmImport);

router.get('/', auth, role('admin', 'superuser', 'storekeeper'), ctrl.list);
router.post('/', auth, role('admin'), ctrl.create);
router.get('/:id', auth, role('admin'), ctrl.get);
router.put('/:id', auth, role('admin'), ctrl.update);
router.post('/:id/authorize', auth, role('admin'), ctrl.authorize);
router.get('/:id/permissions', auth, role('admin'), ctrl.getPermissions);
router.put('/:id/permissions', auth, role('admin'), ctrl.setPermissions);

module.exports = router;
