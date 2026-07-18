const express = require('express');
const router = express.Router();
const { createOfflineBgTracking, getAllOfflineBgTracking, getOfflineBgTrackingById } = require('./offlinebgController');

router.post('/', createOfflineBgTracking);
router.get('/', getAllOfflineBgTracking);
router.get('/:id', getOfflineBgTrackingById);

module.exports = router;
