const express = require('express');
const router = express.Router();
const locationEventController = require('./locationEventController');

// GET all location events
router.get('/', locationEventController.getAllLocationEvents);

// GET location event by ID
router.get('/:id', locationEventController.getLocationEventById);

// CREATE a new location event
router.post('/', locationEventController.createLocationEvent);

// UPDATE a location event
router.put('/:id', locationEventController.updateLocationEvent);

// DELETE a location event
router.delete('/:id', locationEventController.deleteLocationEvent);

module.exports = router;