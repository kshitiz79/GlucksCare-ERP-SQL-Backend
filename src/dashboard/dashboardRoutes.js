const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getUserDashboard } = require('./dashboardController');
const { getLogisticsDashboard } = require('./logisticsDashboardController');

/**
 * @route   GET /api/dashboard/user
 * @desc    Get comprehensive user dashboard data
 * @access  Private (Authenticated users only)
 */
router.get('/user', authMiddleware, getUserDashboard);

/**
 * @route   GET /api/dashboard/logistics
 * @desc    Get logistics dashboard data
 * @access  Private (Authenticated users only)
 */
router.get('/logistics', authMiddleware, getLogisticsDashboard);

module.exports = router;