// src/leave/leaveRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getAllLeaves,
  getLeaveById,
  createLeave,
  updateLeave,
  deleteLeave,
  getMyLeaves,
  applyLeave,
  cancelLeave,
  getLeaveBalance,
  getPendingApprovals,
  approveRejectLeave
} = require('./leaveController');

// GET all leaves (admin)
router.get('/', authMiddleware, getAllLeaves);

// GET my leaves (user)
router.get('/my-leaves', authMiddleware, getMyLeaves);

// GET leave balance (user)
router.get('/balance', authMiddleware, getLeaveBalance);

// GET pending approvals (managers/admins)
router.get('/pending-approvals', authMiddleware, getPendingApprovals);

// POST apply for leave
router.post('/apply', authMiddleware, applyLeave);

// PUT approve/reject leave
router.put('/:id/approve', authMiddleware, approveRejectLeave);

// PUT cancel leave
router.put('/:id/cancel', authMiddleware, cancelLeave);

// GET leave by ID
router.get('/:id', getLeaveById);

// CREATE a new leave (admin)
router.post('/admin', createLeave);

// UPDATE a leave (admin)
router.put('/:id', updateLeave);

// DELETE a leave (admin)
router.delete('/:id', deleteLeave);

module.exports = router;