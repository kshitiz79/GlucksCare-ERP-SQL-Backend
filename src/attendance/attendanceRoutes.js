// src/attendance/attendanceRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance
} = require('./attendanceController');

// GET all attendance records
router.get('/', getAllAttendance);

// GET attendance by ID
router.get('/:id', getAttendanceById);

// CREATE a new attendance record
router.post('/', createAttendance);

// UPDATE an attendance record
router.put('/:id', updateAttendance);

// DELETE an attendance record
router.delete('/:id', deleteAttendance);

module.exports = router;