const PayrollSetting = require('./PayrollSetting');

// GET all payroll settings
const getAllPayrollSettings = async (req, res) => {
  try {
    const payrollSettings = await PayrollSetting.findAll();
    res.json({
      success: true,
      count: payrollSettings.length,
      data: payrollSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET payroll setting by ID
const getPayrollSettingById = async (req, res) => {
  try {
    const payrollSetting = await PayrollSetting.findByPk(req.params.id);
    if (!payrollSetting) {
      return res.status(404).json({
        success: false,
        message: 'Payroll setting not found'
      });
    }
    res.json({
      success: true,
      data: payrollSetting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new payroll setting
const createPayrollSetting = async (req, res) => {
  try {
    const payrollSetting = await PayrollSetting.create(req.body);
    res.status(201).json({
      success: true,
      data: payrollSetting
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a payroll setting
const updatePayrollSetting = async (req, res) => {
  try {
    const payrollSetting = await PayrollSetting.findByPk(req.params.id);
    if (!payrollSetting) {
      return res.status(404).json({
        success: false,
        message: 'Payroll setting not found'
      });
    }
    
    await payrollSetting.update(req.body);
    res.json({
      success: true,
      data: payrollSetting
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a payroll setting
const deletePayrollSetting = async (req, res) => {
  try {
    const payrollSetting = await PayrollSetting.findByPk(req.params.id);
    if (!payrollSetting) {
      return res.status(404).json({
        success: false,
        message: 'Payroll setting not found'
      });
    }
    
    await payrollSetting.destroy();
    res.json({
      success: true,
      message: 'Payroll setting deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllPayrollSettings,
  getPayrollSettingById,
  createPayrollSetting,
  updatePayrollSetting,
  deletePayrollSetting
};