// src/locationEvent/locationEventController.js

// GET all location events
const getAllLocationEvents = async (req, res) => {
  try {
    const { LocationEvent } = req.app.get('models');
    const locationEvents = await LocationEvent.findAll();
    res.json({
      success: true,
      count: locationEvents.length,
      data: locationEvents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET location event by ID
const getLocationEventById = async (req, res) => {
  try {
    const { LocationEvent } = req.app.get('models');
    const locationEvent = await LocationEvent.findByPk(req.params.id);
    if (!locationEvent) {
      return res.status(404).json({
        success: false,
        message: 'Location event not found'
      });
    }
    res.json({
      success: true,
      data: locationEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new location event
const createLocationEvent = async (req, res) => {
  try {
    const { LocationEvent, Location, User } = req.app.get('models');
    const { 
      user_id, 
      device_id, 
      event_type, 
      latitude, 
      longitude, 
      timestamp, 
      metadata 
    } = req.body;

    console.log('Received location event:', req.body);

    // Validate required fields
    if (!user_id || !device_id || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, device_id, latitude, longitude'
      });
    }

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create location event
    const locationEvent = await LocationEvent.create(req.body);

    // Also create location record for tracking
    const locationData = {
      user_id,
      device_id,
      latitude,
      longitude,
      timestamp: timestamp || new Date(),
      accuracy: metadata?.accuracy || null,
      battery_level: metadata?.battery_level || null,
      network_type: metadata?.network_type || null,
      speed: metadata?.speed || null
    };

    const location = await Location.create(locationData);

    console.log('Location event and location created successfully');

    res.status(201).json({
      success: true,
      message: 'Location event received and processed',
      data: {
        locationEvent,
        location
      }
    });
  } catch (error) {
    console.error('Error creating location event:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a location event
const updateLocationEvent = async (req, res) => {
  try {
    const { LocationEvent } = req.app.get('models');
    const locationEvent = await LocationEvent.findByPk(req.params.id);
    if (!locationEvent) {
      return res.status(404).json({
        success: false,
        message: 'Location event not found'
      });
    }
    
    await locationEvent.update(req.body);
    res.json({
      success: true,
      data: locationEvent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a location event
const deleteLocationEvent = async (req, res) => {
  try {
    const { LocationEvent } = req.app.get('models');
    const locationEvent = await LocationEvent.findByPk(req.params.id);
    if (!locationEvent) {
      return res.status(404).json({
        success: false,
        message: 'Location event not found'
      });
    }
    
    await locationEvent.destroy();
    res.json({
      success: true,
      message: 'Location event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLocationEvents,
  getLocationEventById,
  createLocationEvent,
  updateLocationEvent,
  deleteLocationEvent
};