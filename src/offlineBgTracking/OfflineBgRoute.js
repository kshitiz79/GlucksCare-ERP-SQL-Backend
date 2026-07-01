const express = require('express');
const router = express.Router();
const { createOfflineBgTracking, getAllOfflineBgTracking, getOfflineBgTrackingById } = require('./offlinebgController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createOfflineBgTracking);
router.get('/', authMiddleware, getAllOfflineBgTracking);
router.get('/:id', authMiddleware, getOfflineBgTrackingById);

module.exports = router;
