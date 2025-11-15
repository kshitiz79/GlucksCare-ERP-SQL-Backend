// Location Routes
const express = require('express');
const router = express.Router();
const { getUsersWithLocation, getUserLocationHistory } = require('./locationController');
const { authMiddleware } = require('../middleware/authMiddleware');

// GET all users with their latest location (for live location page)
router.get('/users-with-location', authMiddleware, getUsersWithLocation);

// GET location history for a specific user
router.get('/user-history/:userId', authMiddleware, getUserLocationHistory);

module.exports = router;
