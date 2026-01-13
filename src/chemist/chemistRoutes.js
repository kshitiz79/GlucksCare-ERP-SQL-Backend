const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAllChemists,
  getChemistById,
  createChemist,
  updateChemist,
  deleteChemist,
  getChemistsByHeadOffice,
  getMyChemists,
  createBulkChemists
} = require('./chemistController');

const { uploadChemistGeoImage } = require('./chemistImageController');

const { authMiddleware } = require('../middleware/authMiddleware');

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// GET all chemists
router.get('/', authMiddleware, getAllChemists);

// GET chemists by head office ID
router.get('/by-head-office/:headOfficeId', authMiddleware, getChemistsByHeadOffice);

// GET chemists for current user's head offices
router.get('/my-chemists', authMiddleware, getMyChemists);

// GET chemist by ID
router.get('/:id', authMiddleware, getChemistById);

// CREATE a new chemist (with optional geo-image upload)
router.post('/', authMiddleware, upload.single('geo_image'), createChemist);

// CREATE bulk chemists
router.post('/bulk', authMiddleware, createBulkChemists);

// UPLOAD chemist geo-image
router.post('/:id/geo-image', authMiddleware, upload.single('geo_image'), uploadChemistGeoImage);

// UPDATE a chemist (with optional geo-image upload)
router.put('/:id', authMiddleware, upload.single('geo_image'), updateChemist);

// DELETE a chemist
router.delete('/:id', authMiddleware, deleteChemist);

module.exports = router;