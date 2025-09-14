const express = require('express');
const router = express.Router();
const {
  getAllLocationEvents,
  getLocationEventById,
  createLocationEvent,
  updateLocationEvent,
  deleteLocationEvent
} = require('./locationEventController');

// GET all location events
router.get('/', getAllLocationEvents);

// GET location event by ID
router.get('/:id', getLocationEventById);

// CREATE a new location event
router.post('/', createLocationEvent);

// UPDATE a location event
router.put('/:id', updateLocationEvent);

// DELETE a location event
router.delete('/:id', deleteLocationEvent);

module.exports = router;