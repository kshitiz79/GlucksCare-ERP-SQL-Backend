// GET all states
const getAllStates = async (req, res) => {
  try {
    // Get the State model from app context
    const { State } = req.app.get('models');
    const states = await State.findAll();
    res.json({
      success: true,
      count: states.length,
      data: states
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET state by ID
const getStateById = async (req, res) => {
  try {
    // Get the State model from app context
    const { State } = req.app.get('models');
    const state = await State.findByPk(req.params.id);
    if (!state) {
      return res.status(404).json({
        success: false,
        message: 'State not found'
      });
    }
    res.json({
      success: true,
      data: state
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new state
const createState = async (req, res) => {
  try {
    // Get the State model from app context
    const { State } = req.app.get('models');
    
    // Only allow specific fields to be set
    const allowedFields = ['name', 'code', 'country'];
    const stateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        stateData[field] = req.body[field];
      }
    });
    
    const state = await State.create(stateData);
    res.status(201).json({
      success: true,
      data: state
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a state
const updateState = async (req, res) => {
  try {
    // Get the State model from app context
    const { State } = req.app.get('models');
    const state = await State.findByPk(req.params.id);
    if (!state) {
      return res.status(404).json({
        success: false,
        message: 'State not found'
      });
    }
    
    // Only allow specific fields to be updated
    const allowedFields = ['name', 'code', 'country'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    await state.update(updateData);
    res.json({
      success: true,
      data: state
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a state
const deleteState = async (req, res) => {
  try {
    // Get the State model from app context
    const { State } = req.app.get('models');
    const state = await State.findByPk(req.params.id);
    if (!state) {
      return res.status(404).json({
        success: false,
        message: 'State not found'
      });
    }
    
    await state.destroy();
    res.json({
      success: true,
      message: 'State deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllStates,
  getStateById,
  createState,
  updateState,
  deleteState
};