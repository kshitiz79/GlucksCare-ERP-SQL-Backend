const express = require('express');
const router = express.Router();
const {
  getAllEmploymentTypes,
  getEmploymentTypeById,
  createEmploymentType,
  updateEmploymentType,
  deleteEmploymentType
} = require('./employmentTypeController');

// GET all employment types
router.get('/', getAllEmploymentTypes);

// GET employment type by ID
router.get('/:id', getEmploymentTypeById);

// CREATE a new employment type
router.post('/', createEmploymentType);

// UPDATE an employment type
router.put('/:id', updateEmploymentType);

// DELETE an employment type
router.delete('/:id', deleteEmploymentType);

module.exports = router;