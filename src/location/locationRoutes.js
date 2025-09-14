// src/location/locationRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
} = require('./locationController');

// GET all locations
router.get('/', getAllLocations);

// GET location by ID
router.get('/:id', getLocationById);

// CREATE a new location
router.post('/', createLocation);

// UPDATE a location
router.put('/:id', updateLocation);

// DELETE a location
router.delete('/:id', deleteLocation);

module.exports = router;