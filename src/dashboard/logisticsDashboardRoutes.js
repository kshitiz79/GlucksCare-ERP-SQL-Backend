// src/dashboard/logisticsDashboardRoutes.js
const express = require('express');
const router = express.Router();
const logisticsDashboardController = require('./logisticsDashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get logistics dashboard data
router.get('/logistics', authenticateToken, logisticsDashboardController.getLogisticsDashboard);

module.exports = router;
