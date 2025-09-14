
// GET all designations
const getAllDesignations = async (req, res) => {
  try {
    // Get the Designation model from app context
    const { Designation } = req.app.get('models');
    const designations = await Designation.findAll();
    res.json({
      success: true,
      count: designations.length,
      data: designations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET designation by ID
const getDesignationById = async (req, res) => {
  try {
    // Get the Designation model from app context
    const { Designation } = req.app.get('models');
    const designation = await Designation.findByPk(req.params.id);
    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }
    res.json({
      success: true,
      data: designation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new designation
const createDesignation = async (req, res) => {
  try {
    // Get the Designation model from app context
    const { Designation } = req.app.get('models');
    
    // Only allow specific fields to be set
    const allowedFields = ['name', 'description'];
    const designationData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        designationData[field] = req.body[field];
      }
    });
    
    const designation = await Designation.create(designationData);
    res.status(201).json({
      success: true,
      data: designation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a designation
const updateDesignation = async (req, res) => {
  try {
    // Get the Designation model from app context
    const { Designation } = req.app.get('models');
    const designation = await Designation.findByPk(req.params.id);
    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }
    
    // Only allow specific fields to be updated
    const allowedFields = ['name', 'description'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    await designation.update(updateData);
    res.json({
      success: true,
      data: designation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a designation
const deleteDesignation = async (req, res) => {
  try {
    // Get the Designation model from app context
    const { Designation } = req.app.get('models');
    const designation = await Designation.findByPk(req.params.id);
    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }
    
    await designation.destroy();
    res.json({
      success: true,
      message: 'Designation deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation
};