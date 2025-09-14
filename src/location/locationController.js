const Location = require('./Location');

// GET all locations
const getAllLocations = async (req, res) => {
  try {
    const locations = await Location.findAll();
    res.json({
      success: true,
      count: locations.length,
      data: locations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET location by ID
const getLocationById = async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location record not found'
      });
    }
    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new location
const createLocation = async (req, res) => {
  try {
    const location = await Location.create(req.body);
    res.status(201).json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a location
const updateLocation = async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location record not found'
      });
    }
    
    await location.update(req.body);
    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a location
const deleteLocation = async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location record not found'
      });
    }
    
    await location.destroy();
    res.json({
      success: true,
      message: 'Location record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
};