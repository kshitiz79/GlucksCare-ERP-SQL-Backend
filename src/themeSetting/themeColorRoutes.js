// src/themeSetting/themeColorRoutes.js
const express = require('express');
const router = express.Router();
const {
  getThemeColors,
  getFlutterPalette,
  getThemeColorByKey,
  seedFieldOmniColors,
  upsertThemeColor,
  deleteThemeColor
} = require('./themeColorController');

// Public/App GET Routes
router.get('/', getThemeColors);
router.get('/flutter-palette', getFlutterPalette);
router.get('/:key', getThemeColorByKey);

// Upload / Seed all FieldOmni default colors into table
router.post('/seed', seedFieldOmniColors);
router.post('/upload-all', seedFieldOmniColors);

// Create / Update / Delete Routes
router.post('/', upsertThemeColor);
router.put('/:id', upsertThemeColor);
router.delete('/:id', deleteThemeColor);

module.exports = router;
