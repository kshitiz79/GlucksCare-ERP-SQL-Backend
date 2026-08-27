// src/companyDevice/companyDeviceRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getAllCompanyDevices,
  getCompanyDeviceById,
  createCompanyDevice,
  updateCompanyDevice,
  assignCompanyDevice,
  unassignCompanyDevice,
  getEmployeeDeviceHistory,
  getDeviceTimeline,
  deleteCompanyDevice
} = require('./companyDeviceController');

// GET all company devices (with status, brand, search filters)
router.get('/', authMiddleware, getAllCompanyDevices);

// GET employee's complete device change & replacement history (MUST come before /:id)
router.get('/employee/:userId/history', authMiddleware, getEmployeeDeviceHistory);

// GET device location route & timeline with date & time range filters (MUST come before /:id)
router.get('/:id/timeline', authMiddleware, getDeviceTimeline);

// GET single company device by ID
router.get('/:id', authMiddleware, getCompanyDeviceById);

// REGISTER / CREATE a new company device
router.post('/', authMiddleware, createCompanyDevice);

// ASSIGN / REASSIGN a device to an employee
router.post('/:id/assign', authMiddleware, assignCompanyDevice);

// UNASSIGN / RETURN device to stock/repair
router.post('/:id/unassign', authMiddleware, unassignCompanyDevice);

// UPDATE device details
router.put('/:id', authMiddleware, updateCompanyDevice);

// DELETE / RETIRE device
router.delete('/:id', authMiddleware, deleteCompanyDevice);

module.exports = router;
