const StockistAnnualTurnover = require('./StockistAnnualTurnover');

// GET all stockist annual turnovers
const getAllStockistAnnualTurnovers = async (req, res) => {
  try {
    const stockistAnnualTurnovers = await StockistAnnualTurnover.findAll();
    res.json({
      success: true,
      count: stockistAnnualTurnovers.length,
      data: stockistAnnualTurnovers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockist annual turnover by ID
const getStockistAnnualTurnoverById = async (req, res) => {
  try {
    const stockistAnnualTurnover = await StockistAnnualTurnover.findByPk(req.params.id);
    if (!stockistAnnualTurnover) {
      return res.status(404).json({
        success: false,
        message: 'Stockist annual turnover not found'
      });
    }
    res.json({
      success: true,
      data: stockistAnnualTurnover
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new stockist annual turnover
const createStockistAnnualTurnover = async (req, res) => {
  try {
    const stockistAnnualTurnover = await StockistAnnualTurnover.create(req.body);
    res.status(201).json({
      success: true,
      data: stockistAnnualTurnover
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a stockist annual turnover
const updateStockistAnnualTurnover = async (req, res) => {
  try {
    const stockistAnnualTurnover = await StockistAnnualTurnover.findByPk(req.params.id);
    if (!stockistAnnualTurnover) {
      return res.status(404).json({
        success: false,
        message: 'Stockist annual turnover not found'
      });
    }
    
    await stockistAnnualTurnover.update(req.body);
    res.json({
      success: true,
      data: stockistAnnualTurnover
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a stockist annual turnover
const deleteStockistAnnualTurnover = async (req, res) => {
  try {
    const stockistAnnualTurnover = await StockistAnnualTurnover.findByPk(req.params.id);
    if (!stockistAnnualTurnover) {
      return res.status(404).json({
        success: false,
        message: 'Stockist annual turnover not found'
      });
    }
    
    await stockistAnnualTurnover.destroy();
    res.json({
      success: true,
      message: 'Stockist annual turnover deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllStockistAnnualTurnovers,
  getStockistAnnualTurnoverById,
  createStockistAnnualTurnover,
  updateStockistAnnualTurnover,
  deleteStockistAnnualTurnover
};