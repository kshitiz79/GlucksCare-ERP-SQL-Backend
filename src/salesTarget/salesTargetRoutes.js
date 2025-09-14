const express = require('express');
const router = express.Router();
const {
  getAllSalesTargets,
  getSalesTargetById,
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
  getTargetsByUser,
  getMyTargets,
  updateTargetAchievement,
  getDashboardData
} = require('./salesTargetController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Dashboard data
router.get('/dashboard', authMiddleware, getDashboardData);

// Get current user's targets
router.get('/my-targets', authMiddleware, getMyTargets);

// Get all sales targets (with filtering)
router.get('/', authMiddleware, getAllSalesTargets);

// Get targets for a specific user
router.get('/user/:userId', authMiddleware, getTargetsByUser);

// Get sales target by ID
router.get('/:id', authMiddleware, getSalesTargetById);

// Create new sales target (Admin only)
router.post('/', authMiddleware, createSalesTarget);

// Update sales target (Admin only)
router.put('/:id', authMiddleware, updateSalesTarget);

// Update target achievement
router.patch('/:id/achievement', authMiddleware, updateTargetAchievement);

// Delete sales target (Super Admin only)
router.delete('/:id', authMiddleware, deleteSalesTarget);

module.exports = router;