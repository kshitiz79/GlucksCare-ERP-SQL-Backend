const express = require('express');
const router = express.Router();
const { createSale, getSalesByDoctor, getSalesByChemist } = require('./salesController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createSale);
router.get('/doctor/:doctorId', authMiddleware, getSalesByDoctor);
router.get('/chemist/:chemistId', authMiddleware, getSalesByChemist);

module.exports = router;
