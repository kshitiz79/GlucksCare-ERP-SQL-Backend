const express = require('express');
const router = express.Router();
const {
  getAllStockistVisits,
  getStockistVisitById,
  createStockistVisit,
  updateStockistVisit,
  deleteStockistVisit,
  confirmStockistVisit,
  getStockistVisitsByUserId
} = require('./stockistVisitController');

// GET all stockist visits
router.get('/', getAllStockistVisits);

// GET visits by user ID (MUST come before /:id to avoid route conflict)
router.get('/user/:userId', getStockistVisitsByUserId);

// GET stockist visit by ID
router.get('/:id', getStockistVisitById);

// CREATE a new stockist visit
router.post('/', createStockistVisit);

// UPDATE a stockist visit
router.put('/:id', updateStockistVisit);

// DELETE a stockist visit
router.delete('/:id', deleteStockistVisit);

// CONFIRM a stockist visit
router.put('/:id/confirm', confirmStockistVisit);

module.exports = router;