const express = require('express');
const router = express.Router();
const {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  getUsersForShiftAssignment,
  assignUsersToShift
} = require('./shiftController');

// GET all shifts
router.get('/', getAllShifts);

// GET users for shift assignment
router.get('/users/for-shift-assignment', getUsersForShiftAssignment);

// GET shift by ID
router.get('/:id', getShiftById);

// POST assign users to shift
router.post('/:shiftId/assign-users', assignUsersToShift);

// CREATE a new shift
router.post('/', createShift);

// UPDATE a shift
router.put('/:id', updateShift);

// DELETE a shift
router.delete('/:id', deleteShift);

module.exports = router;