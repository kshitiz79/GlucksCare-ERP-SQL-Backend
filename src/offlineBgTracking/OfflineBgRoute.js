const express = require('express');
const router = express.Router();
const { 
  processTelemetryBatch,
  createOfflineBgTracking, 
  getAllOfflineBgTracking, 
  getOfflineBgTrackingById,
  getUsersWithLocation,
  getUserLocationHistory,
  getUserRouteData,
  getAllUsersRouteData,
  getDevicesList,
  bindDeviceToUser
} = require('./offlinebgController');

// Batch telemetry ingestion from mobile foreground service / outbox queue
router.post('/batch', processTelemetryBatch);
router.post('/telemetry/batch', processTelemetryBatch);

router.post('/', createOfflineBgTracking);
router.get('/', getAllOfflineBgTracking);

// Location, Device management, and GPS tracking endpoints
router.get('/live', getUsersWithLocation);
router.get('/users-with-location', getUsersWithLocation);
router.get('/devices', getDevicesList);
router.get('/device-last-coordinates', getDevicesList);
router.post('/bind-device', bindDeviceToUser);
router.get('/admin/user-history/:userId', getUserLocationHistory);
router.get('/route/all', getAllUsersRouteData);
router.get('/route/:userId', getUserRouteData);
router.get('/day/:userId', getUserRouteData);

router.get('/:id', getOfflineBgTrackingById);

module.exports = router;
