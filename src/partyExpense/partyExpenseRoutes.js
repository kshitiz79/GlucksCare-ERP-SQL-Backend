const express = require('express');
const router = express.Router();
const partyExpenseController = require('./partyExpenseController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, partyExpenseController.create);
router.get('/', authMiddleware, partyExpenseController.findAll);

module.exports = router;
