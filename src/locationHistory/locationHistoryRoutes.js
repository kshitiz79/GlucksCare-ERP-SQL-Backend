const express = require('express');
const router = express.Router();
const locationHistoryController = require('./locationHistoryController');

// GET all location histories
router.get('/', locationHistoryController.getAllLocationHistories);

// GET location history by ID
router.get('/:id', locationHistoryController.getLocationHistoryById);

// CREATE a new location history
router.post('/', locationHistoryController.createLocationHistory);

// UPDATE a location history
router.put('/:id', locationHistoryController.updateLocationHistory);

// DELETE a location history
router.delete('/:id', locationHistoryController.deleteLocationHistory);

module.exports = router;