// src/location/locationRoutes.js

const express = require('express');
const router = express.Router();
const locationController = require('./locationController');

// GET all locations
router.get('/', locationController.getAllLocations);

// GET location by ID
router.get('/:id', locationController.getLocationById);

// CREATE a new location
router.post('/', locationController.createLocation);

// UPDATE a location
router.put('/:id', locationController.updateLocation);

// DELETE a location
router.delete('/:id', locationController.deleteLocation);

module.exports = router;