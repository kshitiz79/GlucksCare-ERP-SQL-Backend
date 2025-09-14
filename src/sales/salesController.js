const SalesActivity = require('./SalesActivity');

// GET all sales activities
const getAllSalesActivities = async (req, res) => {
  try {
    const salesActivities = await SalesActivity.findAll();
    res.json({
      success: true,
      count: salesActivities.length,
      data: salesActivities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET sales activity by ID
const getSalesActivityById = async (req, res) => {
  try {
    const salesActivity = await SalesActivity.findByPk(req.params.id);
    if (!salesActivity) {
      return res.status(404).json({
        success: false,
        message: 'Sales activity not found'
      });
    }
    res.json({
      success: true,
      data: salesActivity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new sales activity
const createSalesActivity = async (req, res) => {
  try {
    const salesActivity = await SalesActivity.create(req.body);
    res.status(201).json({
      success: true,
      data: salesActivity
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a sales activity
const updateSalesActivity = async (req, res) => {
  try {
    const salesActivity = await SalesActivity.findByPk(req.params.id);
    if (!salesActivity) {
      return res.status(404).json({
        success: false,
        message: 'Sales activity not found'
      });
    }
    
    await salesActivity.update(req.body);
    res.json({
      success: true,
      data: salesActivity
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a sales activity
const deleteSalesActivity = async (req, res) => {
  try {
    const salesActivity = await SalesActivity.findByPk(req.params.id);
    if (!salesActivity) {
      return res.status(404).json({
        success: false,
        message: 'Sales activity not found'
      });
    }
    
    await salesActivity.destroy();
    res.json({
      success: true,
      message: 'Sales activity deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllSalesActivities,
  getSalesActivityById,
  createSalesActivity,
  updateSalesActivity,
  deleteSalesActivity
};