const express = require('express');
const router = express.Router();
const purchaseController = require('./purchaseController');

// GET all purchases
router.get('/', purchaseController.getAllPurchases);

// GET purchase by ID
router.get('/:id', purchaseController.getPurchaseById);

// POST create purchase
router.post('/', purchaseController.createPurchase);

module.exports = router;
