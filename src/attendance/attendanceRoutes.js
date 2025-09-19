// src/attendance/attendanceRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getTodayAttendanceForAdmin,
  getTodayAttendanceForUser,
  getWeeklyAttendance,
  getMonthlyAttendance,
  getAttendanceStats,
  togglePunch
} = require('./attendanceController');

// GET all attendance records
router.get('/', getAllAttendance);

// GET today's attendance for admin dashboard
router.get('/admin/today', getTodayAttendanceForAdmin);

// GET today's attendance for specific user
router.get('/today/:userId', getTodayAttendanceForUser);

// GET weekly attendance for specific user
router.get('/weekly/:userId', getWeeklyAttendance);

// GET monthly attendance for specific user
router.get('/monthly/:userId', getMonthlyAttendance);

// GET attendance stats for specific user
router.get('/stats/:userId', getAttendanceStats);

// POST toggle punch in/out
router.post('/toggle-punch', togglePunch);

// GET attendance by ID
router.get('/:id', getAttendanceById);

// CREATE a new attendance record
router.post('/', createAttendance);

// UPDATE an attendance record
router.put('/:id', updateAttendance);

// DELETE an attendance record
router.delete('/:id', deleteAttendance);

module.exports = router;