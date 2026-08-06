const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getStateHeadMobileDcr } = require('./dcrController');

// All routes require authentication
router.use(authMiddleware);

// State Head Mobile DCR API (with spelling alias)
router.get('/dcr-statehead-mobile', getStateHeadMobileDcr);
router.get('/dcr-statehead-monile', getStateHeadMobileDcr);

module.exports = router;
