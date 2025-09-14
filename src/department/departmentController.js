
// GET all departments
const getAllDepartments = async (req, res) => {
  try {
    // Get the Department model from app context
    const { Department } = req.app.get('models');
    const departments = await Department.findAll();
    res.json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET department by ID
const getDepartmentById = async (req, res) => {
  try {
    // Get the Department model from app context
    const { Department } = req.app.get('models');
    const department = await Department.findByPk(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new department
const createDepartment = async (req, res) => {
  try {
    // Get the Department model from app context
    const { Department } = req.app.get('models');
    
    // Only allow specific fields to be set
    const allowedFields = ['name', 'code'];
    const departmentData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        departmentData[field] = req.body[field];
      }
    });
    
    const department = await Department.create(departmentData);
    res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a department
const updateDepartment = async (req, res) => {
  try {
    // Get the Department model from app context
    const { Department } = req.app.get('models');
    const department = await Department.findByPk(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
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
    
    await department.update(updateData);
    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a department
const deleteDepartment = async (req, res) => {
  try {
    // Get the Department model from app context
    const { Department } = req.app.get('models');
    const department = await Department.findByPk(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    await department.destroy();
    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
};