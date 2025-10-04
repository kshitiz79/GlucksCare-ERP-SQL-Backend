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
    const { LocationEvent } = req.app.get('models');
    const locationEvent = await LocationEvent.create(req.body);
    res.status(201).json({
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