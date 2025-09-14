const UserManager = require('./UserManager');

// GET all user managers
const getAllUserManagers = async (req, res) => {
  try {
    const userManagers = await UserManager.findAll();
    res.json({
      success: true,
      count: userManagers.length,
      data: userManagers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET user manager by ID
const getUserManagerById = async (req, res) => {
  try {
    const userManager = await UserManager.findByPk(req.params.id);
    if (!userManager) {
      return res.status(404).json({
        success: false,
        message: 'User manager not found'
      });
    }
    res.json({
      success: true,
      data: userManager
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new user manager
const createUserManager = async (req, res) => {
  try {
    const userManager = await UserManager.create(req.body);
    res.status(201).json({
      success: true,
      data: userManager
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a user manager
const deleteUserManager = async (req, res) => {
  try {
    const userManager = await UserManager.findByPk(req.params.id);
    if (!userManager) {
      return res.status(404).json({
        success: false,
        message: 'User manager not found'
      });
    }
    
    await userManager.destroy();
    res.json({
      success: true,
      message: 'User manager deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllUserManagers,
  getUserManagerById,
  createUserManager,
  deleteUserManager
};