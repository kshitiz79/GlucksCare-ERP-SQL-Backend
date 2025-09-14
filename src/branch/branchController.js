
// GET all branches
const getAllBranches = async (req, res) => {
  try {
    // Get the Branch model from app context
    const { Branch } = req.app.get('models');
    const branches = await Branch.findAll();
    res.json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET branch by ID
const getBranchById = async (req, res) => {
  try {
    // Get the Branch model from app context
    const { Branch } = req.app.get('models');
    const branch = await Branch.findByPk(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    res.json({
      success: true,
      data: branch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new branch
const createBranch = async (req, res) => {
  try {
    // Get the Branch model from app context
    const { Branch } = req.app.get('models');
    
    // Only allow specific fields to be set
    const allowedFields = ['name', 'code'];
    const branchData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        branchData[field] = req.body[field];
      }
    });
    
    const branch = await Branch.create(branchData);
    res.status(201).json({
      success: true,
      data: branch
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a branch
const updateBranch = async (req, res) => {
  try {
    // Get the Branch model from app context
    const { Branch } = req.app.get('models');
    const branch = await Branch.findByPk(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
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
    
    await branch.update(updateData);
    res.json({
      success: true,
      data: branch
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a branch
const deleteBranch = async (req, res) => {
  try {
    // Get the Branch model from app context
    const { Branch } = req.app.get('models');
    const branch = await Branch.findByPk(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    await branch.destroy();
    res.json({
      success: true,
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
};