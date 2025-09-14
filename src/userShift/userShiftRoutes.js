const express = require('express');
const router = express.Router();
const {
  getAllUserShifts,
  getUserShiftById,
  createUserShift,
  deleteUserShift
} = require('./userShiftController');

// GET all user shifts
router.get('/', getAllUserShifts);

// GET user shift by ID
router.get('/:id', getUserShiftById);

// CREATE a new user shift
router.post('/', createUserShift);

// DELETE a user shift
router.delete('/:id', deleteUserShift);

module.exports = router;