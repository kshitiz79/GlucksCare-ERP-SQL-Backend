const VisitProductPromoted = require('./VisitProductPromoted');

// GET all visit product promoted records
const getAllVisitProductPromoteds = async (req, res) => {
  try {
    const visitProductPromoteds = await VisitProductPromoted.findAll();
    res.json({
      success: true,
      count: visitProductPromoteds.length,
      data: visitProductPromoteds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET visit product promoted by ID
const getVisitProductPromotedById = async (req, res) => {
  try {
    const visitProductPromoted = await VisitProductPromoted.findByPk(req.params.id);
    if (!visitProductPromoted) {
      return res.status(404).json({
        success: false,
        message: 'Visit product promoted record not found'
      });
    }
    res.json({
      success: true,
      data: visitProductPromoted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new visit product promoted record
const createVisitProductPromoted = async (req, res) => {
  try {
    const visitProductPromoted = await VisitProductPromoted.create(req.body);
    res.status(201).json({
      success: true,
      data: visitProductPromoted
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a visit product promoted record
const deleteVisitProductPromoted = async (req, res) => {
  try {
    const visitProductPromoted = await VisitProductPromoted.findByPk(req.params.id);
    if (!visitProductPromoted) {
      return res.status(404).json({
        success: false,
        message: 'Visit product promoted record not found'
      });
    }
    
    await visitProductPromoted.destroy();
    res.json({
      success: true,
      message: 'Visit product promoted record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllVisitProductPromoteds,
  getVisitProductPromotedById,
  createVisitProductPromoted,
  deleteVisitProductPromoted
};