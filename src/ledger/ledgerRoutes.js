// src/ledger/ledgerRoutes.js
const express = require('express');
const router = express.Router();
const ledgerController = require('./ledgerController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// 1. Get party account ledger statement with continuous running balance
router.get('/party/:stockistId', ledgerController.getPartyLedger);

module.exports = router;
