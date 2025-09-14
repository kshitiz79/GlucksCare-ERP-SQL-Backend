const Visit = require('./Visit');

// GET all visits
const getAllVisits = async (req, res) => {
  try {
    const visits = await Visit.findAll();
    res.json({
      success: true,
      count: visits.length,
      data: visits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET visit by ID
const getVisitById = async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id);
    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit record not found'
      });
    }
    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new visit
const createVisit = async (req, res) => {
  try {
    const visit = await Visit.create(req.body);
    res.status(201).json({
      success: true,
      data: visit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a visit
const updateVisit = async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id);
    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit record not found'
      });
    }
    
    await visit.update(req.body);
    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a visit
const deleteVisit = async (req, res) => {
  try {
    const visit = await Visit.findByPk(req.params.id);
    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit record not found'
      });
    }
    
    await visit.destroy();
    res.json({
      success: true,
      message: 'Visit record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllVisits,
  getVisitById,
  createVisit,
  updateVisit,
  deleteVisit
};