const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getTerritoryMaster } = require('./territoryControllers');

// Apply authentication middleware
router.use(authMiddleware);

// GET /api/territory/master
router.get('/master', getTerritoryMaster);

module.exports = router;
