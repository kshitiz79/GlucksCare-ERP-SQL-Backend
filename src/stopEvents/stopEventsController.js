// src/stopEvents/stopEventsController.js

// GET all stop events
const getAllStopEvents = async (req, res) => {
  try {
    const { StopEvents } = req.app.get('models');
    const stopEvents = await StopEvents.findAll();
    res.json({
      success: true,
      count: stopEvents.length,
      data: stopEvents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stop event by ID
const getStopEventById = async (req, res) => {
  try {
    const { StopEvents } = req.app.get('models');
    const stopEvent = await StopEvents.findByPk(req.params.id);
    if (!stopEvent) {
      return res.status(404).json({
        success: false,
        message: 'Stop event not found'
      });
    }
    res.json({
      success: true,
      data: stopEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new stop event
const createStopEvent = async (req, res) => {
  try {
    const { StopEvents } = req.app.get('models');
    const stopEvent = await StopEvents.create(req.body);
    res.status(201).json({
      success: true,
      data: stopEvent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a stop event
const updateStopEvent = async (req, res) => {
  try {
    const { StopEvents } = req.app.get('models');
    const stopEvent = await StopEvents.findByPk(req.params.id);
    if (!stopEvent) {
      return res.status(404).json({
        success: false,
        message: 'Stop event not found'
      });
    }
    
    await stopEvent.update(req.body);
    res.json({
      success: true,
      data: stopEvent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a stop event
const deleteStopEvent = async (req, res) => {
  try {
    const { StopEvents } = req.app.get('models');
    const stopEvent = await StopEvents.findByPk(req.params.id);
    if (!stopEvent) {
      return res.status(404).json({
        success: false,
        message: 'Stop event not found'
      });
    }
    
    await stopEvent.destroy();
    res.json({
      success: true,
      message: 'Stop event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllStopEvents,
  getStopEventById,
  createStopEvent,
  updateStopEvent,
  deleteStopEvent
};