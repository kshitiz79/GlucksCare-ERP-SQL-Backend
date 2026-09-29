const defaultDb = require('../config/database');
const getModels = (req) => req?.db || (req?.app && req?.app.get('models')) || defaultDb;

const ensureDefaultFinancialYears = async (FinancialYear) => {
  if (!FinancialYear) return;
  try {
    const count = await FinancialYear.count();
    if (count === 0) {
      const defaults = [
        { name: '2024-25', start_date: '2024-04-01', end_date: '2025-03-31', is_active: false },
        { name: '2025-26', start_date: '2025-04-01', end_date: '2026-03-31', is_active: false },
        { name: '2026-27', start_date: '2026-04-01', end_date: '2027-03-31', is_active: true },
        { name: '2027-28', start_date: '2027-04-01', end_date: '2028-03-31', is_active: false }
      ];
      for (const d of defaults) {
        await FinancialYear.create(d);
      }
    }
  } catch (err) {
    console.warn('ensureDefaultFinancialYears warning:', err.message);
  }
};

const getAllFinancialYears = async (req, res) => {
  try {
    const { FinancialYear } = getModels(req);
    await ensureDefaultFinancialYears(FinancialYear);
    const financialYears = await FinancialYear.findAll({
      order: [['start_date', 'DESC']]
    });
    res.json({
      success: true,
      count: financialYears.length,
      data: financialYears
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getActiveFinancialYear = async (req, res) => {
  try {
    const { FinancialYear } = getModels(req);
    await ensureDefaultFinancialYears(FinancialYear);
    let activeFY = await FinancialYear.findOne({
      where: { is_active: true }
    });
    if (!activeFY) {
      activeFY = await FinancialYear.findOne({
        order: [['start_date', 'DESC']]
      });
    }
    
    if (!activeFY) {
      return res.status(404).json({
        success: false,
        message: 'No active financial year found'
      });
    }
    
    res.json({
      success: true,
      data: activeFY
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const createFinancialYear = async (req, res) => {
  try {
    const { FinancialYear } = getModels(req);
    const { name, start_date, end_date, is_active } = req.body;

    const isActiveBool = is_active === true || is_active === 'true';

    // If setting to active, mark all others inactive
    if (isActiveBool) {
      await FinancialYear.update(
        { is_active: false },
        { where: {} }
      );
    }

    const financialYear = await FinancialYear.create({
      name,
      start_date,
      end_date,
      is_active: isActiveBool
    });

    res.status(201).json({
      success: true,
      data: financialYear
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const updateFinancialYear = async (req, res) => {
  try {
    const { FinancialYear } = getModels(req);
    const { id } = req.params;
    const { name, start_date, end_date, is_active } = req.body;

    const financialYear = await FinancialYear.findByPk(id);
    if (!financialYear) {
      return res.status(404).json({
        success: false,
        message: 'Financial year not found'
      });
    }

    const isActiveBool = is_active === true || is_active === 'true';

    // If updating to active, mark all others inactive
    if (isActiveBool && !financialYear.is_active) {
      await FinancialYear.update(
        { is_active: false },
        { where: {} }
      );
    }

    await financialYear.update({
      name: name !== undefined ? name : financialYear.name,
      start_date: start_date !== undefined ? start_date : financialYear.start_date,
      end_date: end_date !== undefined ? end_date : financialYear.end_date,
      is_active: is_active !== undefined ? isActiveBool : financialYear.is_active
    });

    res.json({
      success: true,
      data: financialYear
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const deleteFinancialYear = async (req, res) => {
  try {
    const { FinancialYear } = getModels(req);
    const { id } = req.params;

    const financialYear = await FinancialYear.findByPk(id);
    if (!financialYear) {
      return res.status(404).json({
        success: false,
        message: 'Financial year not found'
      });
    }

    await financialYear.destroy();

    res.json({
      success: true,
      message: 'Financial year deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllFinancialYears,
  getActiveFinancialYear,
  createFinancialYear,
  updateFinancialYear,
  deleteFinancialYear
};
