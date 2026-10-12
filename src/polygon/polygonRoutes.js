// Sql-Backend/src/polygon/polygonRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const polygonController = require('./polygonController');

// All routes require authentication
router.use(authMiddleware);

// 1. Territory Polygons based on User's assigned Headquarter(s) (supports single & multiple HQs)
router.get('/my-territory', polygonController.getUserTerritoryPolygons);
router.get('/territory', polygonController.getUserTerritoryPolygons);

// 2. Lookup & District endpoints
router.get('/districts', polygonController.getDistricts);
router.get('/pincode/:pincode', polygonController.getPolygonByPincode);
router.get('/:id', polygonController.getPolygonById);

// 3. List all with filters / search
router.get('/', polygonController.getAllPolygons);

// 4. Admin ingestion trigger
router.post('/ingest', polygonController.runPolygonIngestion);

module.exports = router;
