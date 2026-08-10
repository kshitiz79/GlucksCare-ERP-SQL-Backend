// src/userActivityLog/userActivityLogRoutes.js

const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('./userActivityLogController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, getActivityLogs);

module.exports = router;
