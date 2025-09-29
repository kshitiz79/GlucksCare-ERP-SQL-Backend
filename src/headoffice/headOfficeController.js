// GET all head offices
const getAllHeadOffices = async (req, res) => {
  try {
    // Get the HeadOffice and State models from app context
    const { HeadOffice, State } = req.app.get('models');
    const headOffices = await HeadOffice.findAll({
      include: [
        {
          model: State,
          as: 'State',
          attributes: ['id', 'name', 'code']
        }
      ]
    });
    res.json({
      success: true,
      count: headOffices.length,
      data: headOffices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET head office by ID
const getHeadOfficeById = async (req, res) => {
  try {
    // Get the HeadOffice and State models from app context
    const { HeadOffice, State } = req.app.get('models');
    const headOffice = await HeadOffice.findByPk(req.params.id, {
      include: [
        {
          model: State,
          as: 'State',
          attributes: ['id', 'name', 'code']
        }
      ]
    });
    if (!headOffice) {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }
    res.json({
      success: true,
      data: headOffice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET head offices by state for State Head users
const getHeadOfficesByStateForStateHead = async (req, res) => {
  try {
    // Get the HeadOffice, State, and User models from app context
    const { HeadOffice, State, User } = req.app.get('models');
    
    // Check if user is a State Head
    if (req.user.role !== 'State Head') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only State Head users can access this endpoint.'
      });
    }
    
    // Get the state assigned to this State Head user
    const stateHeadUser = await User.findByPk(req.user.id);
    if (!stateHeadUser || !stateHeadUser.state_id) {
      return res.status(400).json({
        success: false,
        message: 'State Head user does not have a state assigned.'
      });
    }
    
    // Find all head offices belonging to this state
    const headOffices = await HeadOffice.findAll({
      where: {
        stateId: stateHeadUser.state_id
      },
      include: [
        {
          model: State,
          as: 'State',
          attributes: ['id', 'name', 'code']
        }
      ]
    });
    
    res.json({
      success: true,
      count: headOffices.length,
      data: headOffices
    });
  } catch (error) {
    console.error('Error fetching head offices by state:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new head office
const createHeadOffice = async (req, res) => {
  try {
    // Get the HeadOffice model from app context
    const { HeadOffice } = req.app.get('models');
    
    // Only allow specific fields to be set
    const allowedFields = ['name', 'stateId', 'pincode'];
    const headOfficeData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        headOfficeData[field] = req.body[field];
      }
    });
    
    const headOffice = await HeadOffice.create(headOfficeData);
    res.status(201).json({
      success: true,
      data: headOffice
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a head office
const updateHeadOffice = async (req, res) => {
  try {
    // Get the HeadOffice model from app context
    const { HeadOffice } = req.app.get('models');
    const headOffice = await HeadOffice.findByPk(req.params.id);
    if (!headOffice) {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }
    
    // Only allow specific fields to be updated
    const allowedFields = ['name', 'stateId', 'pincode'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    await headOffice.update(updateData);
    res.json({
      success: true,
      data: headOffice
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a head office
const deleteHeadOffice = async (req, res) => {
  try {
    // Get the HeadOffice model from app context
    const { HeadOffice } = req.app.get('models');
    const headOffice = await HeadOffice.findByPk(req.params.id);
    if (!headOffice) {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }
    
    await headOffice.destroy();
    res.json({
      success: true,
      message: 'Head office deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllHeadOffices,
  getHeadOfficeById,
  getHeadOfficesByStateForStateHead,
  createHeadOffice,
  updateHeadOffice,
  deleteHeadOffice
};