const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getAllAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea,
  getAreasByHeadOffice
} = require('./areaControllers');

// Protect all routes with authMiddleware
router.use(authMiddleware);

router.get('/', getAllAreas);
router.get('/by-head-office/:headOfficeId', getAreasByHeadOffice);
router.get('/:id', getAreaById);
router.post('/', createArea);
router.put('/:id', updateArea);
router.delete('/:id', deleteArea);

module.exports = router;
