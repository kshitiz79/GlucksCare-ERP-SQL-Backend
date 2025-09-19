// Holiday Routes - PostgreSQL version
const express = require('express');
const router = express.Router();
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');
const {
  getAllHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getHolidaysForCalendar,
  checkHoliday,
  getCurrentUser
} = require('./holidayController');

// Get holidays for calendar view (authenticated users)
router.get('/calendar', authMiddleware, getHolidaysForCalendar);

// Debug: Get current user info
router.get('/debug/user', authMiddleware, getCurrentUser);

// Check if date is holiday (authenticated users)
router.get('/check/:date', authMiddleware, checkHoliday);

// Get all holidays (authenticated users)
router.get('/', authMiddleware, getAllHolidays);

// Get holiday by ID (authenticated users)
router.get('/:id', authMiddleware, getHolidayById);

// Create new holiday (Admin only)
router.post('/', authMiddleware, createHoliday);

// Update holiday (Admin only)
router.put('/:id', authMiddleware, updateHoliday);

// Delete holiday (Super Admin only)
router.delete('/:id', authMiddleware, deleteHoliday);

module.exports = router;