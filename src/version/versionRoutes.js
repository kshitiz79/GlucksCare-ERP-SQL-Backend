const express = require('express');
const router = express.Router();

// Import controller functions
const {
  checkAppVersion,
  setLatestAppVersion,
  getLatestAppVersion,
  getAllVersionChecks,
  manualVersionCleanup,
  getCleanupStats
} = require('./versionController');

// Import authentication middleware
const { authMiddleware } = require('../middleware/authMiddleware');

// User routes
router.post('/check', authMiddleware, checkAppVersion); // Check app version

// Admin routes
router.post('/admin/set-latest-version', authMiddleware, setLatestAppVersion); // Set latest app version (Admin only)
router.get('/admin/get-latest-version', authMiddleware, getLatestAppVersion); // Get latest app version (Admin only)
router.get('/admin/users', authMiddleware, getAllVersionChecks); // Get all users with version status (Admin only)

// Cleanup routes (Admin only)
router.post('/admin/cleanup', authMiddleware, manualVersionCleanup); // Manual cleanup of old version records
router.get('/admin/cleanup-stats', authMiddleware, getCleanupStats); // Get cleanup statistics

module.exports = router;