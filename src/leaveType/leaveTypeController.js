const LeaveType = require('./LeaveType');

// GET all leave types
const getAllLeaveTypes = async (req, res) => {
  try {
    const leaveTypes = await LeaveType.findAll();
    res.json({
      success: true,
      count: leaveTypes.length,
      data: leaveTypes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET leave type by ID
const getLeaveTypeById = async (req, res) => {
  try {
    const leaveType = await LeaveType.findByPk(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }
    res.json({
      success: true,
      data: leaveType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new leave type
const createLeaveType = async (req, res) => {
  try {
    const leaveType = await LeaveType.create(req.body);
    res.status(201).json({
      success: true,
      data: leaveType
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a leave type
const updateLeaveType = async (req, res) => {
  try {
    const leaveType = await LeaveType.findByPk(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }
    
    await leaveType.update(req.body);
    res.json({
      success: true,
      data: leaveType
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a leave type
const deleteLeaveType = async (req, res) => {
  try {
    const leaveType = await LeaveType.findByPk(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }
    
    await leaveType.destroy();
    res.json({
      success: true,
      message: 'Leave type deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType
};