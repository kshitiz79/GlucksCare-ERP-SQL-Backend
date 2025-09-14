const express = require('express');
const router = express.Router();
const {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift
} = require('./shiftController');

// GET all shifts
router.get('/', getAllShifts);

// GET shift by ID
router.get('/:id', getShiftById);

// CREATE a new shift
router.post('/', createShift);

// UPDATE a shift
router.put('/:id', updateShift);

// DELETE a shift
router.delete('/:id', deleteShift);

module.exports = router;