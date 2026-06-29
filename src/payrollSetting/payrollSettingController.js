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

    const { full_day_hours, half_day_hours, working_days_per_month, full_day_deduction, half_day_deduction, absent_deduction, leave_deduction, overtime_rate, hra, da, pf, esi, late_coming_deduction, enable_overtime, enable_hra, enable_da, enable_pf, enable_esi, enable_half_day_deduction, enable_absent_deduction, enable_leave_deduction, enable_late_coming_deduction, shift_id, created_by, updated_by } = req.body;

    const payrollSetting = await PayrollSetting.create({
      full_day_hours,
      half_day_hours,
      working_days_per_month,
      full_day_deduction,
      half_day_deduction,
      absent_deduction,
      leave_deduction,
      overtime_rate,
      hra,
      da,
      pf,
      esi,
      late_coming_deduction,
      enable_overtime,
      enable_hra,
      enable_da,
      enable_pf,
      enable_esi,
      enable_half_day_deduction,
      enable_absent_deduction,
      enable_leave_deduction,
      enable_late_coming_deduction,
      shift_id,
      created_by,
      updated_by
    });


    res.status(201).json({
      success: true,
      message: "Payroll setting created successfully",
      data: payrollSetting
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}









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

    const { full_day_hours, half_day_hours, working_days_per_month, full_day_deduction, half_day_deduction, absent_deduction, leave_deduction, overtime_rate, hra, da, pf, esi, late_coming_deduction, enable_overtime, enable_hra, enable_da, enable_pf, enable_esi, enable_half_day_deduction, enable_absent_deduction, enable_leave_deduction, enable_late_coming_deduction, shift_id, updated_by } = req.body;

    await payrollSetting.update({
      full_day_hours,
      half_day_hours,
      working_days_per_month,
      full_day_deduction,
      half_day_deduction,
      absent_deduction,
      leave_deduction,
      overtime_rate,
      hra,
      da,
      pf,
      esi,
      late_coming_deduction,
      enable_overtime,
      enable_hra,
      enable_da,
      enable_pf,
      enable_esi,
      enable_half_day_deduction,
      enable_absent_deduction,
      enable_leave_deduction,
      enable_late_coming_deduction,
      shift_id,
      // Don't update created_by
      updated_by
    });

    res.status(200).json({
      success: true,
      message: "Payroll setting updated successfully",
      data: payrollSetting
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}






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
