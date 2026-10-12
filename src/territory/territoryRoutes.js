const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getTerritoryMaster } = require('./territoryControllers');
const { getUserTerritoryPolygons } = require('../polygon/polygonController');

// Apply authentication middleware
router.use(authMiddleware);

// GET /api/territory/master
router.get('/master', getTerritoryMaster);

// GET /api/territory/polygon and GET /api/territory/polygons
router.get('/polygon', getUserTerritoryPolygons);
router.get('/polygons', getUserTerritoryPolygons);

module.exports = router;
