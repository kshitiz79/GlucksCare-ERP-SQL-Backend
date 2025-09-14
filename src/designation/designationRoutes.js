const express = require('express');
const router = express.Router();
const {
  getAllDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation
} = require('./designationController');

// GET all designations
router.get('/', getAllDesignations);

// GET designation by ID
router.get('/:id', getDesignationById);

// CREATE a new designation
router.post('/', createDesignation);

// UPDATE a designation
router.put('/:id', updateDesignation);

// DELETE a designation
router.delete('/:id', deleteDesignation);

module.exports = router;