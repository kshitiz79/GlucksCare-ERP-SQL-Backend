const express = require('express');
const router = express.Router();
const partyController = require('./partycontroller');

// GET all parties (Doctors, Stockists, Chemists, Users)
router.get('/all', partyController.getAllParties);

module.exports = router;
