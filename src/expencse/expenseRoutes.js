const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  getExpenseSettings,
  updateExpenseSettings,
  uploadBillImage
} = require('./expenseController');

// GET expense settings
router.get('/settings', getExpenseSettings);

// UPDATE expense settings
router.put('/settings', updateExpenseSettings);

// UPLOAD bill image
router.post('/upload-bill', upload.single('bill'), uploadBillImage);

// GET all expenses
router.get('/', getAllExpenses);

// GET expense by ID
router.get('/:id', getExpenseById);

// CREATE a new expense (supports both JSON with base64 and form-data with file)
router.post('/', upload.single('bill'), createExpense);

// UPDATE an expense (supports both JSON with base64 and form-data with file)
router.put('/:id', upload.single('bill'), updateExpense);

// DELETE an expense
router.delete('/:id', deleteExpense);

// APPROVE an expense
router.put('/:id/approve', approveExpense);

// REJECT an expense
router.put('/:id/reject', rejectExpense);

module.exports = router;