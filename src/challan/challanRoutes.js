const express = require('express');
const router = express.Router();
const challanController = require('./challanController');

// GET all challans
router.get('/', challanController.getAllChallans);

// POST create challan
router.post('/', challanController.createChallan);

module.exports = router;
