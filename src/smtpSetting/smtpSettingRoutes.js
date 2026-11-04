const express = require('express');
const router = express.Router();
const {
  getSmtpSettings,
  updateSmtpSettings,
  testSmtpSettings,
  sendBulkEmail
} = require('./smtpSettingController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Middleware to restrict to Super Admin / Admin
const adminOnly = (req, res, next) => {
  if (!req.user || !['Super Admin', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Only administrators can manage SMTP settings'
    });
  }
  next();
};

// GET current SMTP settings
router.get('/', authMiddleware, adminOnly, getSmtpSettings);

// UPDATE SMTP settings
router.put('/', authMiddleware, adminOnly, updateSmtpSettings);

// TEST SMTP settings
router.post('/test', authMiddleware, adminOnly, testSmtpSettings);

// SEND BULK EMAIL (Admin only)
router.post('/send-bulk-email', authMiddleware, adminOnly, sendBulkEmail);

module.exports = router;
