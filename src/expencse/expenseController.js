const Expense = require('./Expense');

// GET all expenses
const getAllExpenses = async (req, res) => {
  try {
    const expenses = await Expense.findAll();
    res.json({
      success: true,
      count: expenses.length,
      data: expenses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET expense by ID
const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }
    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new expense
const createExpense = async (req, res) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE an expense
const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }
    
    await expense.update(req.body);
    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE an expense
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }
    
    await expense.destroy();
    res.json({
      success: true,
      message: 'Expense record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense
};