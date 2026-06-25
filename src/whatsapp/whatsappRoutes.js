// Sql-Backend/src/whatsapp/whatsappRoutes.js
const express = require('express');
const router = express.Router();

// Import controller functions
const { getSettings, saveSettings } = require('./whatsappSettingsController');

// Import authentication middlewares
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');

// Get Settings (any authenticated user can retrieve templates if they are permitted to see dashboards or dispatch messages)
router.get('/settings', authMiddleware, getSettings);

// Save Settings (Only Super Admins or Admins can change configuration)
router.post('/settings', authMiddleware, adminAuth, saveSettings);

module.exports = router;
