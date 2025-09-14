const express = require('express');
const router = express.Router();
const {
  getAllVisitProductAgreeds,
  getVisitProductAgreedById,
  createVisitProductAgreed,
  deleteVisitProductAgreed
} = require('./visitProductAgreedController');

// GET all visit product agreed records
router.get('/', getAllVisitProductAgreeds);

// GET visit product agreed by ID
router.get('/:id', getVisitProductAgreedById);

// CREATE a new visit product agreed record
router.post('/', createVisitProductAgreed);

// DELETE a visit product agreed record
router.delete('/:id', deleteVisitProductAgreed);

module.exports = router;