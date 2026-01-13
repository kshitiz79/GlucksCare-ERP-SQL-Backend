const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorsByHeadOffice,
  getMyDoctors,
  createBulkDoctors
} = require('./doctorController');

const { uploadDoctorGeoImage } = require('./doctorImageController');

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

// GET all doctors
router.get('/', authMiddleware, getAllDoctors);

// GET doctors by head office ID
router.get('/by-head-office/:headOfficeId', authMiddleware, getDoctorsByHeadOffice);

// GET doctors for current user's head offices
router.get('/my-doctors', authMiddleware, getMyDoctors);

// GET doctor by ID
router.get('/:id', authMiddleware, getDoctorById);

// CREATE multiple doctors at once (Bulk Creation)
router.post('/bulk', authMiddleware, createBulkDoctors);

// CREATE a new doctor (with optional geo-image upload)
router.post('/', authMiddleware, upload.single('geo_image'), createDoctor);

// UPLOAD doctor geo-image
router.post('/:id/geo-image', authMiddleware, upload.single('geo_image'), uploadDoctorGeoImage);

// UPDATE a doctor (with optional geo-image upload)
router.put('/:id', authMiddleware, upload.single('geo_image'), updateDoctor);

// DELETE a doctor
router.delete('/:id', authMiddleware, deleteDoctor);

module.exports = router;