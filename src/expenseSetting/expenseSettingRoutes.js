const express = require('express');
const router = express.Router();
const {
  getAllExpenseSettings,
  getExpenseSettingById,
  createExpenseSetting,
  updateExpenseSetting,
  deleteExpenseSetting
} = require('./expenseSettingController');

// GET all expense settings
router.get('/', getAllExpenseSettings);

// GET expense setting by ID
router.get('/:id', getExpenseSettingById);

// CREATE a new expense setting
router.post('/', createExpenseSetting);

// UPDATE an expense setting
router.put('/:id', updateExpenseSetting);

// DELETE an expense setting
router.delete('/:id', deleteExpenseSetting);

module.exports = router;