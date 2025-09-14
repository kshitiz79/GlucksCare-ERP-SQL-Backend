const DoctorVisitHistory = require('./DoctorVisitHistory');

// GET all doctor visit histories
const getAllDoctorVisitHistories = async (req, res) => {
  try {
    const doctorVisitHistories = await DoctorVisitHistory.findAll();
    res.json({
      success: true,
      count: doctorVisitHistories.length,
      data: doctorVisitHistories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET doctor visit history by ID
const getDoctorVisitHistoryById = async (req, res) => {
  try {
    const doctorVisitHistory = await DoctorVisitHistory.findByPk(req.params.id);
    if (!doctorVisitHistory) {
      return res.status(404).json({
        success: false,
        message: 'Doctor visit history not found'
      });
    }
    res.json({
      success: true,
      data: doctorVisitHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new doctor visit history
const createDoctorVisitHistory = async (req, res) => {
  try {
    const doctorVisitHistory = await DoctorVisitHistory.create(req.body);
    res.status(201).json({
      success: true,
      data: doctorVisitHistory
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a doctor visit history
const updateDoctorVisitHistory = async (req, res) => {
  try {
    const doctorVisitHistory = await DoctorVisitHistory.findByPk(req.params.id);
    if (!doctorVisitHistory) {
      return res.status(404).json({
        success: false,
        message: 'Doctor visit history not found'
      });
    }
    
    await doctorVisitHistory.update(req.body);
    res.json({
      success: true,
      data: doctorVisitHistory
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a doctor visit history
const deleteDoctorVisitHistory = async (req, res) => {
  try {
    const doctorVisitHistory = await DoctorVisitHistory.findByPk(req.params.id);
    if (!doctorVisitHistory) {
      return res.status(404).json({
        success: false,
        message: 'Doctor visit history not found'
      });
    }
    
    await doctorVisitHistory.destroy();
    res.json({
      success: true,
      message: 'Doctor visit history deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllDoctorVisitHistories,
  getDoctorVisitHistoryById,
  createDoctorVisitHistory,
  updateDoctorVisitHistory,
  deleteDoctorVisitHistory
};