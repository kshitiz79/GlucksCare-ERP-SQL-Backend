const express = require('express');
const router = express.Router();
const { 
  createOfflineBgTracking, 
  getAllOfflineBgTracking, 
  getOfflineBgTrackingById,
  getUsersWithLocation,
  getUserLocationHistory,
  getUserRouteData,
  getAllUsersRouteData
} = require('./offlinebgController');

router.post('/', createOfflineBgTracking);
router.get('/', getAllOfflineBgTracking);

// Location and GPS tracking endpoints (registered before :id to prevent parameter conflict)
router.get('/users-with-location', getUsersWithLocation);
router.get('/admin/user-history/:userId', getUserLocationHistory);
router.get('/route/all', getAllUsersRouteData);
router.get('/route/:userId', getUserRouteData);

router.get('/:id', getOfflineBgTrackingById);

module.exports = router;
