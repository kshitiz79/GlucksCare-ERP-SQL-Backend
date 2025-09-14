const ChemistAnnualTurnover = require('./ChemistAnnualTurnover');

// GET all chemist annual turnovers
const getAllChemistAnnualTurnovers = async (req, res) => {
  try {
    const chemistAnnualTurnovers = await ChemistAnnualTurnover.findAll();
    res.json({
      success: true,
      count: chemistAnnualTurnovers.length,
      data: chemistAnnualTurnovers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET chemist annual turnover by ID
const getChemistAnnualTurnoverById = async (req, res) => {
  try {
    const chemistAnnualTurnover = await ChemistAnnualTurnover.findByPk(req.params.id);
    if (!chemistAnnualTurnover) {
      return res.status(404).json({
        success: false,
        message: 'Chemist annual turnover not found'
      });
    }
    res.json({
      success: true,
      data: chemistAnnualTurnover
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new chemist annual turnover
const createChemistAnnualTurnover = async (req, res) => {
  try {
    const chemistAnnualTurnover = await ChemistAnnualTurnover.create(req.body);
    res.status(201).json({
      success: true,
      data: chemistAnnualTurnover
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a chemist annual turnover
const updateChemistAnnualTurnover = async (req, res) => {
  try {
    const chemistAnnualTurnover = await ChemistAnnualTurnover.findByPk(req.params.id);
    if (!chemistAnnualTurnover) {
      return res.status(404).json({
        success: false,
        message: 'Chemist annual turnover not found'
      });
    }
    
    await chemistAnnualTurnover.update(req.body);
    res.json({
      success: true,
      data: chemistAnnualTurnover
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a chemist annual turnover
const deleteChemistAnnualTurnover = async (req, res) => {
  try {
    const chemistAnnualTurnover = await ChemistAnnualTurnover.findByPk(req.params.id);
    if (!chemistAnnualTurnover) {
      return res.status(404).json({
        success: false,
        message: 'Chemist annual turnover not found'
      });
    }
    
    await chemistAnnualTurnover.destroy();
    res.json({
      success: true,
      message: 'Chemist annual turnover deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllChemistAnnualTurnovers,
  getChemistAnnualTurnoverById,
  createChemistAnnualTurnover,
  updateChemistAnnualTurnover,
  deleteChemistAnnualTurnover
};