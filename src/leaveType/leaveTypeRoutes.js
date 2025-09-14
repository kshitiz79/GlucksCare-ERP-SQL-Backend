const express = require('express');
const router = express.Router();
const {
  getAllLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType
} = require('./leaveTypeController');

// GET all leave types
router.get('/', getAllLeaveTypes);

// GET leave type by ID
router.get('/:id', getLeaveTypeById);

// CREATE a new leave type
router.post('/', createLeaveType);

// UPDATE a leave type
router.put('/:id', updateLeaveType);

// DELETE a leave type
router.delete('/:id', deleteLeaveType);

module.exports = router;