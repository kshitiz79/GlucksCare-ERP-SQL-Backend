const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAllStockists,
  getStockistById,
  createStockist,
  updateStockist,
  deleteStockist,
  getStockistsByHeadOffice,
  getMyStockists,
  createBulkStockists
} = require('./stockistController');

const { uploadStockistDocuments, uploadStockistGeoImage } = require('./stockistImageController');

const { authMiddleware } = require('../middleware/authMiddleware');

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit (increased from 10MB)
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image files and PDFs are allowed!'), false);
    }
  }
});

// GET all stockists
router.get('/', authMiddleware, getAllStockists);

// GET stockists by head office ID
router.get('/by-head-office/:headOfficeId', authMiddleware, getStockistsByHeadOffice);

// GET stockists for current user's head offices
router.get('/my-stockists', authMiddleware, getMyStockists);

// GET stockist by ID
router.get('/:id', authMiddleware, getStockistById);

// CREATE a new stockist with optional document upload
router.post('/', authMiddleware, upload.fields([
  { name: 'gstCertificate', maxCount: 1 },
  { name: 'drugLicense', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'cancelledCheque', maxCount: 1 },
  { name: 'businessProfile', maxCount: 1 }
]), createStockist);

// CREATE bulk stockists
router.post('/bulk', authMiddleware, createBulkStockists);

// UPDATE a stockist (with optional geo-image upload)
router.put('/:id', authMiddleware, upload.single('geo_image'), updateStockist);

// UPLOAD stockist documents - Fixed to accept individual file fields
router.post('/:id/documents', authMiddleware, upload.fields([
  { name: 'gstCertificate', maxCount: 1 },
  { name: 'drugLicense', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'cancelledCheque', maxCount: 1 },
  { name: 'businessProfile', maxCount: 1 }
]), uploadStockistDocuments);

// UPLOAD stockist geo-image
router.post('/:id/geo-image', authMiddleware, upload.single('geo_image'), uploadStockistGeoImage);

// DELETE a stockist
router.delete('/:id', authMiddleware, deleteStockist);

module.exports = router;