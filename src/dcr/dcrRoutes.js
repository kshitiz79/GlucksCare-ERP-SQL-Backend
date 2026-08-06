const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getStateHeadMobileDcr } = require('./dcrController');

// All routes require authentication
router.use(authMiddleware);

// State Head Mobile DCR API
router.get('/dcr-statehead-mobile', getStateHeadMobileDcr);

module.exports = router;
