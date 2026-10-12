const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getPartnerBridgeData,
  assignPartnerToMr,
  bulkAssignPartners,
  linkStockistToPartner
} = require('./partnerBridgeController');

// All routes require authentication
router.use(authMiddleware);

// GET /api/partner-bridge/data
router.get('/data', getPartnerBridgeData);

// POST /api/partner-bridge/assign
router.post('/assign', assignPartnerToMr);

// POST /api/partner-bridge/bulk-assign
router.post('/bulk-assign', bulkAssignPartners);

// POST /api/partner-bridge/link-stockist
router.post('/link-stockist', linkStockistToPartner);

module.exports = router;
