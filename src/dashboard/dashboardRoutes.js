const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getUserDashboard } = require('./dashboardController');

/**
 * @route   GET /api/dashboard/user
 * @desc    Get comprehensive user dashboard data
 * @access  Private (Authenticated users only)
 */
router.get('/user', authMiddleware, getUserDashboard);

module.exports = router;