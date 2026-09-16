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
  uploadBillImage,
  finalizeMonthPayment,
  getPaymentSummary,
  sendExpenseReportEmail,
  getUserVisitsSummary
} = require('./expenseController');

// GET expense settings
router.get('/settings', getExpenseSettings);

// UPDATE expense settings
router.put('/settings', updateExpenseSettings);

// UPLOAD bill image
router.post('/upload-bill', upload.single('bill'), uploadBillImage);

// GET payment summary by month (placed before /:id)
router.get('/payment-summary', getPaymentSummary);

// GET user visits summary for mileage verification (placed before /:id)
router.get('/user-visits-summary/:userId', getUserVisitsSummary);

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

// FINALIZE payment for a month
router.post('/finalize-payment', finalizeMonthPayment);

// SEND expense report via email
router.post('/send-email', sendExpenseReportEmail);

module.exports = router;