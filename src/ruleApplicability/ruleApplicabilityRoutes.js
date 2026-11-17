// src/ruleApplicability/ruleApplicabilityRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getFieldOptions,
  previewFilter,
  evaluateUser
} = require('./ruleApplicabilityController');

// All endpoints require authentication
router.use(authMiddleware);

router.get('/options', getFieldOptions);
router.post('/preview', previewFilter);
router.post('/evaluate-user', evaluateUser);

module.exports = router;

