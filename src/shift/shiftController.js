const Shift = require('./Shift');

// GET all shifts
const getAllShifts = async (req, res) => {
  try {
    const shifts = await Shift.findAll();
    res.json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET shift by ID
const getShiftById = async (req, res) => {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }
    res.json({
      success: true,
      data: shift
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new shift
const createShift = async (req, res) => {
  try {
    const shift = await Shift.create(req.body);
    res.status(201).json({
      success: true,
      data: shift
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a shift
const updateShift = async (req, res) => {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }
    
    await shift.update(req.body);
    res.json({
      success: true,
      data: shift
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a shift
const deleteShift = async (req, res) => {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }
    
    await shift.destroy();
    res.json({
      success: true,
      message: 'Shift deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift
};