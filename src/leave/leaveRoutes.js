// src/leave/leaveRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllLeaves,
  getLeaveById,
  createLeave,
  updateLeave,
  deleteLeave
} = require('./leaveController');

// GET all leaves
router.get('/', getAllLeaves);

// GET leave by ID
router.get('/:id', getLeaveById);

// CREATE a new leave
router.post('/', createLeave);

// UPDATE a leave
router.put('/:id', updateLeave);

// DELETE a leave
router.delete('/:id', deleteLeave);

module.exports = router;