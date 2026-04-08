const express = require('express');
const router = express.Router();
const inventoryController = require('./inventoryController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Admin Routes for Inventory Master
router.post('/items', inventoryController.createInventoryItem);
router.get('/items', inventoryController.getInventoryItems);

// Admin Routes for Assigning items
router.post('/assign', inventoryController.assignInventoryToUser);
router.get('/assignments', inventoryController.getAllAssignments);
router.get('/gift-distribution', inventoryController.getAllGiftDistribution);

// User Route to get their own inventory
router.get('/my-inventory', inventoryController.getUserInventory);
router.get('/user/:user_id', inventoryController.getUserInventory);

module.exports = router;
