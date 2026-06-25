const getAllFinancialYears = async (req, res) => {
  try {
    const { FinancialYear } = req.app.get('models');
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
    const { FinancialYear } = req.app.get('models');
    const activeFY = await FinancialYear.findOne({
      where: { is_active: true }
    });
    
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
    const { FinancialYear } = req.app.get('models');
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
    const { FinancialYear } = req.app.get('models');
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
    const { FinancialYear } = req.app.get('models');
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
