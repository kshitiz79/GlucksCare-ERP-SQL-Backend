// src/partyOpeningBalance/partyOpeningBalanceRoutes.js
const express = require('express');
const router = express.Router();
const partyOpeningBalanceController = require('./partyOpeningBalanceController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// 1. Check discrepancies between previous and current FY
router.get('/discrepancies', partyOpeningBalanceController.checkDiscrepancies);

// 2. Carry forward balances
router.post('/carry-forward', partyOpeningBalanceController.carryForwardBalances);

// 3. Get all opening balances for an FY
router.get('/', partyOpeningBalanceController.getOpeningBalances);

// 4. Get opening balance for single stockist in an FY
router.get('/:stockistId', partyOpeningBalanceController.getPartyOpeningBalance);

// 5. Upsert opening balance (Single or Bulk)
router.post('/', partyOpeningBalanceController.upsertOpeningBalance);

module.exports = router;
