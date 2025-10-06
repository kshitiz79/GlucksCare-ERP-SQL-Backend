// src/location/locationController.js

// GET all locations
const getAllLocations = async (req, res) => {
  try {
    const { Location } = req.app.get('models');
    
    console.log('Fetching locations with query params:', req.query);
    
    // Support filtering by user_id if provided
    const whereClause = {};
    if (req.query.user_id) {
      whereClause.user_id = req.query.user_id;
    }
    
    const options = {
      where: whereClause
    };
    
    // Add limit if specified
    if (req.query.limit) {
      options.limit = parseInt(req.query.limit);
    }
    
    console.log('Location query options:', options);
    
    const locations = await Location.findAll(options);
    
    console.log('Found locations:', locations.length);
    
    res.json({
      success: true,
      count: locations.length,
      data: locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations: ' + error.message
    });
  }
};

// GET location by ID
const getLocationById = async (req, res) => {
  try {
    const { Location } = req.app.get('models');
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
    const { Location } = req.app.get('models');
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
    const { Location } = req.app.get('models');
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
    const { Location } = req.app.get('models');
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
