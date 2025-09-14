const express = require('express');
const router = express.Router();
const {
  getAllChemistVisits,
  getChemistVisitById,
  createChemistVisit,
  updateChemistVisit,
  deleteChemistVisit,
  confirmChemistVisit,
  getChemistVisitsByUserId
} = require('./chemistVisitController');

// GET all chemist visits
router.get('/', getAllChemistVisits);

// GET chemist visit by ID
router.get('/:id', getChemistVisitById);

// CREATE a new chemist visit
router.post('/', createChemistVisit);

// UPDATE a chemist visit
router.put('/:id', updateChemistVisit);

// DELETE a chemist visit
router.delete('/:id', deleteChemistVisit);

// CONFIRM a chemist visit
router.put('/:id/confirm', confirmChemistVisit);

// GET visits by user ID
router.get('/user/:userId', getChemistVisitsByUserId);

module.exports = router;