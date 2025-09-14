const ExpenseSetting = require('./ExpenseSetting');

// GET all expense settings
const getAllExpenseSettings = async (req, res) => {
  try {
    const expenseSettings = await ExpenseSetting.findAll();
    res.json({
      success: true,
      count: expenseSettings.length,
      data: expenseSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET expense setting by ID
const getExpenseSettingById = async (req, res) => {
  try {
    const expenseSetting = await ExpenseSetting.findByPk(req.params.id);
    if (!expenseSetting) {
      return res.status(404).json({
        success: false,
        message: 'Expense setting not found'
      });
    }
    res.json({
      success: true,
      data: expenseSetting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new expense setting
const createExpenseSetting = async (req, res) => {
  try {
    const expenseSetting = await ExpenseSetting.create(req.body);
    res.status(201).json({
      success: true,
      data: expenseSetting
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE an expense setting
const updateExpenseSetting = async (req, res) => {
  try {
    const expenseSetting = await ExpenseSetting.findByPk(req.params.id);
    if (!expenseSetting) {
      return res.status(404).json({
        success: false,
        message: 'Expense setting not found'
      });
    }
    
    await expenseSetting.update(req.body);
    res.json({
      success: true,
      data: expenseSetting
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE an expense setting
const deleteExpenseSetting = async (req, res) => {
  try {
    const expenseSetting = await ExpenseSetting.findByPk(req.params.id);
    if (!expenseSetting) {
      return res.status(404).json({
        success: false,
        message: 'Expense setting not found'
      });
    }
    
    await expenseSetting.destroy();
    res.json({
      success: true,
      message: 'Expense setting deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllExpenseSettings,
  getExpenseSettingById,
  createExpenseSetting,
  updateExpenseSetting,
  deleteExpenseSetting
};