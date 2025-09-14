const express = require('express');
const router = express.Router();
const {
  getAllVisitProductPromoteds,
  getVisitProductPromotedById,
  createVisitProductPromoted,
  deleteVisitProductPromoted
} = require('./visitProductPromotedController');

// GET all visit product promoted records
router.get('/', getAllVisitProductPromoteds);

// GET visit product promoted by ID
router.get('/:id', getVisitProductPromotedById);

// CREATE a new visit product promoted record
router.post('/', createVisitProductPromoted);

// DELETE a visit product promoted record
router.delete('/:id', deleteVisitProductPromoted);

module.exports = router;