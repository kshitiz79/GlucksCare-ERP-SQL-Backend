const express = require('express');
const router = express.Router();
const {
  getAllVisitProductNotAgreeds,
  getVisitProductNotAgreedById,
  createVisitProductNotAgreed,
  deleteVisitProductNotAgreed
} = require('./visitProductNotAgreedController');

// GET all visit product not agreed records
router.get('/', getAllVisitProductNotAgreeds);

// GET visit product not agreed by ID
router.get('/:id', getVisitProductNotAgreedById);

// CREATE a new visit product not agreed record
router.post('/', createVisitProductNotAgreed);

// DELETE a visit product not agreed record
router.delete('/:id', deleteVisitProductNotAgreed);

module.exports = router;