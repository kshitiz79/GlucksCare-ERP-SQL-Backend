// src/headoffice/headOfficeRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getAllHeadOffices,
  getHeadOfficeById,
  getHeadOfficesByStateForStateHead,
  createHeadOffice,
  updateHeadOffice,
  deleteHeadOffice
} = require('./headOfficeController');

// GET all head offices
router.get('/', getAllHeadOffices);

// GET head offices by state for State Head users
router.get('/by-state', authMiddleware, getHeadOfficesByStateForStateHead);

// GET head office by ID
router.get('/:id', getHeadOfficeById);

// CREATE a new head office
router.post('/', createHeadOffice);

// UPDATE a head office
router.put('/:id', updateHeadOffice);

// DELETE a head office
router.delete('/:id', deleteHeadOffice);

module.exports = router;