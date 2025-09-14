const express = require('express');
const router = express.Router();
const {
  getAllLocationHistories,
  getLocationHistoryById,
  createLocationHistory,
  updateLocationHistory,
  deleteLocationHistory
} = require('./locationHistoryController');

// GET all location histories
router.get('/', getAllLocationHistories);

// GET location history by ID
router.get('/:id', getLocationHistoryById);

// CREATE a new location history
router.post('/', createLocationHistory);

// UPDATE a location history
router.put('/:id', updateLocationHistory);

// DELETE a location history
router.delete('/:id', deleteLocationHistory);

module.exports = router;