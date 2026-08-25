const express = require('express');
const upload = require('../middleware/upload.middleware');
const importController = require('../controllers/import.controller');

const router = express.Router();

router.post('/', upload.single('file'), importController.uploadImport);
router.get('/', importController.listImports);
router.get('/:id', importController.getImportStatus);
router.get('/:id/errors', importController.getImportErrors);

module.exports = router;
