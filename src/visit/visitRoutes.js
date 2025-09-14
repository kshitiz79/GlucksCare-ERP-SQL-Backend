const express = require('express');
const router = express.Router();
const {
  getAllVisits,
  getVisitById,
  createVisit,
  updateVisit,
  deleteVisit
} = require('./visitController');

// GET all visits
router.get('/', getAllVisits);

// GET visit by ID
router.get('/:id', getVisitById);

// CREATE a new visit
router.post('/', createVisit);

// UPDATE a visit
router.put('/:id', updateVisit);

// DELETE a visit
router.delete('/:id', deleteVisit);

module.exports = router;