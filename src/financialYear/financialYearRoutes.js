const express = require('express');
const router = express.Router();
const {
  getAllFinancialYears,
  getActiveFinancialYear,
  createFinancialYear,
  updateFinancialYear,
  deleteFinancialYear
} = require('./financialYearController');

const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');

// Get active financial year
router.get('/active', authMiddleware, getActiveFinancialYear);

// Get all financial years
router.get('/', authMiddleware, getAllFinancialYears);

// Create a new financial year
router.post('/', authMiddleware, adminAuth, createFinancialYear);

// Update a financial year
router.put('/:id', authMiddleware, adminAuth, updateFinancialYear);

// Delete a financial year
router.delete('/:id', authMiddleware, adminAuth, deleteFinancialYear);

module.exports = router;
