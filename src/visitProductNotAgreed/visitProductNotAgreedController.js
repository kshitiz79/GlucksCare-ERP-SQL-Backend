const VisitProductNotAgreed = require('./VisitProductNotAgreed');

// GET all visit product not agreed records
const getAllVisitProductNotAgreeds = async (req, res) => {
  try {
    const visitProductNotAgreeds = await VisitProductNotAgreed.findAll();
    res.json({
      success: true,
      count: visitProductNotAgreeds.length,
      data: visitProductNotAgreeds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET visit product not agreed by ID
const getVisitProductNotAgreedById = async (req, res) => {
  try {
    const visitProductNotAgreed = await VisitProductNotAgreed.findByPk(req.params.id);
    if (!visitProductNotAgreed) {
      return res.status(404).json({
        success: false,
        message: 'Visit product not agreed record not found'
      });
    }
    res.json({
      success: true,
      data: visitProductNotAgreed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new visit product not agreed record
const createVisitProductNotAgreed = async (req, res) => {
  try {
    const visitProductNotAgreed = await VisitProductNotAgreed.create(req.body);
    res.status(201).json({
      success: true,
      data: visitProductNotAgreed
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a visit product not agreed record
const deleteVisitProductNotAgreed = async (req, res) => {
  try {
    const visitProductNotAgreed = await VisitProductNotAgreed.findByPk(req.params.id);
    if (!visitProductNotAgreed) {
      return res.status(404).json({
        success: false,
        message: 'Visit product not agreed record not found'
      });
    }
    
    await visitProductNotAgreed.destroy();
    res.json({
      success: true,
      message: 'Visit product not agreed record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllVisitProductNotAgreeds,
  getVisitProductNotAgreedById,
  createVisitProductNotAgreed,
  deleteVisitProductNotAgreed
};