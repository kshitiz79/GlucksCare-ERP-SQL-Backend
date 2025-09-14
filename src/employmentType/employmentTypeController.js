
// GET all employment types
const getAllEmploymentTypes = async (req, res) => {
  try {
    // Get the EmploymentType model from app context
    const { EmploymentType } = req.app.get('models');
    const employmentTypes = await EmploymentType.findAll();
    res.json({
      success: true,
      count: employmentTypes.length,
      data: employmentTypes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET employment type by ID
const getEmploymentTypeById = async (req, res) => {
  try {
    // Get the EmploymentType model from app context
    const { EmploymentType } = req.app.get('models');
    const employmentType = await EmploymentType.findByPk(req.params.id);
    if (!employmentType) {
      return res.status(404).json({
        success: false,
        message: 'Employment type not found'
      });
    }
    res.json({
      success: true,
      data: employmentType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new employment type
const createEmploymentType = async (req, res) => {
  try {
    // Get the EmploymentType model from app context
    const { EmploymentType } = req.app.get('models');
    
    // Only allow specific fields to be set
    const allowedFields = ['name', 'code'];
    const employmentTypeData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        employmentTypeData[field] = req.body[field];
      }
    });
    
    const employmentType = await EmploymentType.create(employmentTypeData);
    res.status(201).json({
      success: true,
      data: employmentType
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE an employment type
const updateEmploymentType = async (req, res) => {
  try {
    // Get the EmploymentType model from app context
    const { EmploymentType } = req.app.get('models');
    const employmentType = await EmploymentType.findByPk(req.params.id);
    if (!employmentType) {
      return res.status(404).json({
        success: false,
        message: 'Employment type not found'
      });
    }
    
    // Only allow specific fields to be updated
    const allowedFields = ['name', 'code'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    await employmentType.update(updateData);
    res.json({
      success: true,
      data: employmentType
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE an employment type
const deleteEmploymentType = async (req, res) => {
  try {
    // Get the EmploymentType model from app context
    const { EmploymentType } = req.app.get('models');
    const employmentType = await EmploymentType.findByPk(req.params.id);
    if (!employmentType) {
      return res.status(404).json({
        success: false,
        message: 'Employment type not found'
      });
    }
    
    await employmentType.destroy();
    res.json({
      success: true,
      message: 'Employment type deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllEmploymentTypes,
  getEmploymentTypeById,
  createEmploymentType,
  updateEmploymentType,
  deleteEmploymentType
};