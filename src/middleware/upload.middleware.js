const multer = require('multer');
const path = require('path');
const { MAX_FILE_SIZE_BYTES } = require('../validators/file.validator');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

// Basic multer-level filter (extension). The full validation (including
// size, which multer also enforces via `limits`) happens again explicitly
// in file.validator.js so the error messages are consistent either way.
const fileFilter = (req, file, cb) => {
  const isCsv =
    file.originalname.toLowerCase().endsWith('.csv') ||
    ['text/csv', 'application/vnd.ms-excel'].includes(file.mimetype);

  if (!isCsv) {
    return cb(new Error('Only .csv files are allowed.'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

module.exports = upload;
