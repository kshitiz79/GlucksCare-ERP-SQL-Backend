// src/webDashboard/webDashboardRoutes.js
const express = require('express');
const router = express.Router();
const { getWebDashboardData, getQuickStats, getReferenceData } = require('./webDashboardController');
const { authMiddleware } = require('../middleware/authMiddleware');

// GET web dashboard data (all data in single call)
router.get('/data', authMiddleware, getWebDashboardData);

// GET quick stats only (for faster initial load)
router.get('/quick-stats', authMiddleware, getQuickStats);

module.exports = router;