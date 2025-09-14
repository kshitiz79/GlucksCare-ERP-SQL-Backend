const express = require('express');
const router = express.Router();
const {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense
} = require('./expenseController');

// GET all expenses
router.get('/', getAllExpenses);

// GET expense by ID
router.get('/:id', getExpenseById);

// CREATE a new expense
router.post('/', createExpense);

// UPDATE an expense
router.put('/:id', updateExpense);

// DELETE an expense
router.delete('/:id', deleteExpense);

module.exports = router;