// src/locationHistory/locationHistoryController.js

// GET all location histories
const getAllLocationHistories = async (req, res) => {
  try {
    const { LocationHistory } = req.app.get('models');
    const locationHistories = await LocationHistory.findAll();
    res.json({
      success: true,
      count: locationHistories.length,
      data: locationHistories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET location history by ID
const getLocationHistoryById = async (req, res) => {
  try {
    const { LocationHistory } = req.app.get('models');
    const locationHistory = await LocationHistory.findByPk(req.params.id);
    if (!locationHistory) {
      return res.status(404).json({
        success: false,
        message: 'Location history not found'
      });
    }
    res.json({
      success: true,
      data: locationHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new location history
const createLocationHistory = async (req, res) => {
  try {
    const { LocationHistory } = req.app.get('models');
    const locationHistory = await LocationHistory.create(req.body);
    res.status(201).json({
      success: true,
      data: locationHistory
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a location history
const updateLocationHistory = async (req, res) => {
  try {
    const { LocationHistory } = req.app.get('models');
    const locationHistory = await LocationHistory.findByPk(req.params.id);
    if (!locationHistory) {
      return res.status(404).json({
        success: false,
        message: 'Location history not found'
      });
    }
    
    await locationHistory.update(req.body);
    res.json({
      success: true,
      data: locationHistory
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a location history
const deleteLocationHistory = async (req, res) => {
  try {
    const { LocationHistory } = req.app.get('models');
    const locationHistory = await LocationHistory.findByPk(req.params.id);
    if (!locationHistory) {
      return res.status(404).json({
        success: false,
        message: 'Location history not found'
      });
    }
    
    await locationHistory.destroy();
    res.json({
      success: true,
      message: 'Location history deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLocationHistories,
  getLocationHistoryById,
  createLocationHistory,
  updateLocationHistory,
  deleteLocationHistory
};