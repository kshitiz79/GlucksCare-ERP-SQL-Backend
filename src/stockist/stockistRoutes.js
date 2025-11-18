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

const { uploadStockistDocuments } = require('./stockistImageController');

const { authMiddleware } = require('../middleware/authMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// GET all stockists
router.get('/', authMiddleware, getAllStockists);

// GET stockists by head office ID
router.get('/by-head-office/:headOfficeId', authMiddleware, getStockistsByHeadOffice);

// GET stockists for current user's head offices
router.get('/my-stockists', authMiddleware, getMyStockists);

// GET stockist by ID
router.get('/:id', authMiddleware, getStockistById);

// CREATE a new stockist
router.post('/', authMiddleware, createStockist);

// CREATE bulk stockists
router.post('/bulk', authMiddleware, createBulkStockists);

// UPDATE a stockist
router.put('/:id', authMiddleware, updateStockist);

// UPLOAD stockist documents - Fixed to accept individual file fields
router.post('/:id/documents', authMiddleware, upload.fields([
  { name: 'gstCertificate', maxCount: 1 },
  { name: 'drugLicense', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'cancelledCheque', maxCount: 1 },
  { name: 'businessProfile', maxCount: 1 }
]), uploadStockistDocuments);

// DELETE a stockist
router.delete('/:id', authMiddleware, deleteStockist);

module.exports = router;