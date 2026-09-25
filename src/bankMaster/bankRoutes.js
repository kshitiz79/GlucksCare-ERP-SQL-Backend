// src/bankMaster/bankRoutes.js
const express = require('express');
const router = express.Router();
const bankController = require('./bankController');
const { requireAuth } = require('../middleware/authMiddleware');

// All bank endpoints require authentication
router.use(requireAuth);

router.get('/', bankController.getBanks);
router.get('/:id', bankController.getBankById);
router.post('/', bankController.createBank);
router.put('/:id', bankController.updateBank);
router.delete('/:id', bankController.deleteBank);
router.patch('/:id/set-primary', bankController.setPrimaryBank);
router.patch('/:id/toggle-status', bankController.toggleBankStatus);

module.exports = router;
