// src/dcrSettings/dcrSettingsRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getDcrSettings, getDcrSettingsHistory, saveDcrSettings } = require('./dcrSettingsController');

router.use(authMiddleware);

// GET active settings (used by DirectorDCR dashboard)
router.get('/', getDcrSettings);

// GET full history
router.get('/history', getDcrSettingsHistory);

// POST save new settings
router.post('/', saveDcrSettings);

module.exports = router;
