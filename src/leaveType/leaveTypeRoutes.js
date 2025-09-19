const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getAllLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  toggleLeaveTypeStatus
} = require('./leaveTypeController');

// GET all leave types
router.get('/', getAllLeaveTypes);

// GET leave type by ID
router.get('/:id', getLeaveTypeById);

// POST toggle leave type status
router.post('/:id/toggle-status', authMiddleware, toggleLeaveTypeStatus);

// CREATE a new leave type
router.post('/', authMiddleware, createLeaveType);

// UPDATE a leave type
router.put('/:id', authMiddleware, updateLeaveType);

// DELETE a leave type
router.delete('/:id', authMiddleware, deleteLeaveType);

module.exports = router;