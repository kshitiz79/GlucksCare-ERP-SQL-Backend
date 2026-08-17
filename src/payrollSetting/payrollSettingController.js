// GET all payroll settings
const getAllPayrollSettings = async (req, res) => {
  try {
    // Get the PayrollSetting model from the request app
    const PayrollSetting = req.app.get('models').PayrollSetting;

    // Support filtering by shift_id if provided
    const filter = {};
    if (req.query.shift_id) {
      filter.shift_id = req.query.shift_id;
    }

    const payrollSettings = await PayrollSetting.findAll({
      where: filter
    });

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
    // Get the PayrollSetting model from the request app
    const PayrollSetting = req.app.get('models').PayrollSetting;

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





const createPayrollSetting = async (req, res) => {
  try {
    const PayrollSetting = req.app.get('models').PayrollSetting;
    const data = { ...req.body };

    const payrollSetting = await PayrollSetting.create(data);

    res.status(201).json({
      success: true,
      message: "Payroll setting created successfully",
      data: payrollSetting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updatePayrollSetting = async (req, res) => {
  try {
    const PayrollSetting = req.app.get('models').PayrollSetting;

    const payrollSetting = await PayrollSetting.findByPk(req.params.id);
    if (!payrollSetting) {
      return res.status(404).json({
        success: false,
        message: 'Payroll setting not found'
      });
    }

    const data = { ...req.body };
    delete data.created_by; // Preserve created_by

    await payrollSetting.update(data);

    res.status(200).json({
      success: true,
      message: "Payroll setting updated successfully",
      data: payrollSetting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};






// DELETE a payroll setting
const deletePayrollSetting = async (req, res) => {
  try {
    // Get the PayrollSetting model from the request app
    const PayrollSetting = req.app.get('models').PayrollSetting;

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
