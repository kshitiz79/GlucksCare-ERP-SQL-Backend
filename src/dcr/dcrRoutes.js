const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getStateHeadMobileDcr, getUserWiseVisits } = require('./dcrController');

// All routes require authentication
router.use(authMiddleware);

// State Head Mobile DCR API
router.get('/dcr-statehead-mobile', getStateHeadMobileDcr);

// User-Wise Visit List API
router.get('/user-wise-visits', getUserWiseVisits);

module.exports = router;
