const UserShift = require('./UserShift');

// GET all user shifts
const getAllUserShifts = async (req, res) => {
  try {
    const userShifts = await UserShift.findAll();
    res.json({
      success: true,
      count: userShifts.length,
      data: userShifts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET user shift by ID
const getUserShiftById = async (req, res) => {
  try {
    const userShift = await UserShift.findByPk(req.params.id);
    if (!userShift) {
      return res.status(404).json({
        success: false,
        message: 'User shift not found'
      });
    }
    res.json({
      success: true,
      data: userShift
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new user shift
const createUserShift = async (req, res) => {
  try {
    const userShift = await UserShift.create(req.body);
    res.status(201).json({
      success: true,
      data: userShift
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a user shift
const deleteUserShift = async (req, res) => {
  try {
    const userShift = await UserShift.findByPk(req.params.id);
    if (!userShift) {
      return res.status(404).json({
        success: false,
        message: 'User shift not found'
      });
    }
    
    await userShift.destroy();
    res.json({
      success: true,
      message: 'User shift deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllUserShifts,
  getUserShiftById,
  createUserShift,
  deleteUserShift
};