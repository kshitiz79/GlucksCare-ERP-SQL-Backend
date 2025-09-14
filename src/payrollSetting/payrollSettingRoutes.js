const express = require('express');
const router = express.Router();
const {
  getAllPayrollSettings,
  getPayrollSettingById,
  createPayrollSetting,
  updatePayrollSetting,
  deletePayrollSetting
} = require('./payrollSettingController');

// GET all payroll settings
router.get('/', getAllPayrollSettings);

// GET payroll setting by ID
router.get('/:id', getPayrollSettingById);

// CREATE a new payroll setting
router.post('/', createPayrollSetting);

// UPDATE a payroll setting
router.put('/:id', updatePayrollSetting);

// DELETE a payroll setting
router.delete('/:id', deletePayrollSetting);

module.exports = router;