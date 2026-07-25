const express = require('express');
const router = express.Router();
const {
  getAreasWithDoctorCoordinates,
  getDoctorsByPincode,
  getAreaBoundaryById,
  getBoundaryByPincode,
  getAreaBoundariesAll,
  getDoctorsByAssignedHeadOffice,
  getDoctorsByHeadOfficeId
} = require('./doctorCoordinatesController');

const { authMiddleware } = require('../middleware/authMiddleware');

// 1. GET all areas in a list with assigned doctor names and coordinates
router.get('/areas', authMiddleware, getAreasWithDoctorCoordinates);

// 2. GET doctor names and coordinates by area pincode
router.get('/by-pincode/:pincode', authMiddleware, getDoctorsByPincode);
router.get('/by-pincode', authMiddleware, getDoctorsByPincode);

// 3. GET outermost boundary coordinates (hull) for a specific area by areaId
router.get('/area-boundary/:areaId', authMiddleware, getAreaBoundaryById);

// 4. GET outermost boundary coordinates (hull) for doctors by pincode
router.get('/boundary/by-pincode/:pincode', authMiddleware, getBoundaryByPincode);
router.get('/boundary/by-pincode', authMiddleware, getBoundaryByPincode);

// 5. GET outermost boundary coordinates (hull) for all areas
router.get('/area-boundaries', authMiddleware, getAreaBoundariesAll);

// 6. GET areas and doctor coordinates based on logged-in user's assigned Head Office(s)
router.get('/assigned-headoffice', authMiddleware, getDoctorsByAssignedHeadOffice);

// 7. GET areas and doctor coordinates by specific Head Office ID
router.get('/by-headoffice/:headOfficeId', authMiddleware, getDoctorsByHeadOfficeId);

module.exports = router;
