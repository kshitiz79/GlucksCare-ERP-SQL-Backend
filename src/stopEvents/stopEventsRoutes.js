const express = require('express');
const router = express.Router();
const stopEventsController = require('./stopEventsController');

// GET all stop events
router.get('/', stopEventsController.getAllStopEvents);

// GET stop event by ID
router.get('/:id', stopEventsController.getStopEventById);

// CREATE a new stop event
router.post('/', stopEventsController.createStopEvent);

// UPDATE a stop event
router.put('/:id', stopEventsController.updateStopEvent);

// DELETE a stop event
router.delete('/:id', stopEventsController.deleteStopEvent);

module.exports = router;