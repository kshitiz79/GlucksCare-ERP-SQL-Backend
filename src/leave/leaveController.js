const Leave = require('./Leave');

// GET all leaves
const getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.findAll();
    res.json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET leave by ID
const getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave record not found'
      });
    }
    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new leave
const createLeave = async (req, res) => {
  try {
    const leave = await Leave.create(req.body);
    res.status(201).json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a leave
const updateLeave = async (req, res) => {
  try {
    const leave = await Leave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave record not found'
      });
    }
    
    await leave.update(req.body);
    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a leave
const deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave record not found'
      });
    }
    
    await leave.destroy();
    res.json({
      success: true,
      message: 'Leave record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLeaves,
  getLeaveById,
  createLeave,
  updateLeave,
  deleteLeave
};