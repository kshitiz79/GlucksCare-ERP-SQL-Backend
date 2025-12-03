// Location Routes
const express = require('express');
const router = express.Router();
const {
    getUsersWithLocation,
    getUserLocationHistory,
    getUserRouteData,
    getAllUsersRouteData
} = require('./locationController');
const { authMiddleware } = require('../middleware/authMiddleware');

// GET all users with their latest location (for live location page)
router.get('/users-with-location', authMiddleware, getUsersWithLocation);

// GET location history for a specific user
router.get('/user-history/:userId', authMiddleware, getUserLocationHistory);

// GET filtered route data for all users (optimized for Google Maps - 1 point per 10 min)
router.get('/route/all', authMiddleware, getAllUsersRouteData);

// GET filtered route data for a specific user (optimized for Google Maps - 1 point per 10 min)
router.get('/route/:userId', authMiddleware, getUserRouteData);

module.exports = router;
