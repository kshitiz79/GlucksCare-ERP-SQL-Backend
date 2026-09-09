const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo
} = require('./companySettingController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Configure multer for memory storage (buffer will be sent to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Middleware to restrict to Super Admin / Admin
const adminOnly = (req, res, next) => {
  if (!req.user || !['Super Admin', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Only administrators can modify company branding and settings'
    });
  }
  next();
};

// GET current company settings (Public / Authenticated)
router.get('/', getCompanySettings);

// UPDATE company settings (Admin Only)
router.put('/', authMiddleware, adminOnly, updateCompanySettings);

// UPLOAD company logo (Admin Only)
router.post('/upload-logo', authMiddleware, adminOnly, upload.single('logo'), uploadCompanyLogo);

module.exports = router;
