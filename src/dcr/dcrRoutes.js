const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getStateHeadMobileDcr, getUserWiseVisits, getUserDcrById } = require('./dcrController');

// All routes require authentication
router.use(authMiddleware);

// State Head Mobile DCR API
router.get('/dcr-statehead-mobile', getStateHeadMobileDcr);

// User-Wise Visit List API
router.get('/user-wise-visits', getUserWiseVisits);

// Get DCR Visits by User ID API
router.get('/user/:userId', getUserDcrById);

module.exports = router;
