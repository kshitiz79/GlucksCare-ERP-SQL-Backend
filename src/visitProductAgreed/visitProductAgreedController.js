const VisitProductAgreed = require('./VisitProductAgreed');

// GET all visit product agreed records
const getAllVisitProductAgreeds = async (req, res) => {
  try {
    const visitProductAgreeds = await VisitProductAgreed.findAll();
    res.json({
      success: true,
      count: visitProductAgreeds.length,
      data: visitProductAgreeds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET visit product agreed by ID
const getVisitProductAgreedById = async (req, res) => {
  try {
    const visitProductAgreed = await VisitProductAgreed.findByPk(req.params.id);
    if (!visitProductAgreed) {
      return res.status(404).json({
        success: false,
        message: 'Visit product agreed record not found'
      });
    }
    res.json({
      success: true,
      data: visitProductAgreed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new visit product agreed record
const createVisitProductAgreed = async (req, res) => {
  try {
    const visitProductAgreed = await VisitProductAgreed.create(req.body);
    res.status(201).json({
      success: true,
      data: visitProductAgreed
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a visit product agreed record
const deleteVisitProductAgreed = async (req, res) => {
  try {
    const visitProductAgreed = await VisitProductAgreed.findByPk(req.params.id);
    if (!visitProductAgreed) {
      return res.status(404).json({
        success: false,
        message: 'Visit product agreed record not found'
      });
    }
    
    await visitProductAgreed.destroy();
    res.json({
      success: true,
      message: 'Visit product agreed record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllVisitProductAgreeds,
  getVisitProductAgreedById,
  createVisitProductAgreed,
  deleteVisitProductAgreed
};