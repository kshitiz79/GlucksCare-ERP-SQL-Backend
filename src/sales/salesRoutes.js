// src/sales/salesRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllSalesActivities,
  getSalesActivityById,
  createSalesActivity,
  updateSalesActivity,
  deleteSalesActivity
} = require('./salesController');

// GET all sales activities
router.get('/', getAllSalesActivities);

// GET sales activity by ID
router.get('/:id', getSalesActivityById);

// CREATE a new sales activity
router.post('/', createSalesActivity);

// UPDATE a sales activity
router.put('/:id', updateSalesActivity);

// DELETE a sales activity
router.delete('/:id', deleteSalesActivity);

module.exports = router;