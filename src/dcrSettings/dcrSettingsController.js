// src/dcrSettings/dcrSettingsController.js
// Stores global DCR daily call targets (doctor / chemist / stockist)

/**
 * GET active DCR settings — returns the most recently saved config
 */
const getDcrSettings = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');

    const rows = await sequelize.query(
      `SELECT * FROM dcr_settings ORDER BY created_at DESC LIMIT 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    if (rows.length === 0) {
      // Return safe defaults if no config exists yet
      return res.json({
        success: true,
        data: {
          doctor_target: 10,
          chemist_target: 5,
          stockist_target: 2,
          total_target: 17,
          updated_by: null,
          created_at: null
        }
      });
    }

    const cfg = rows[0];
    return res.json({
      success: true,
      data: {
        id: cfg.id,
        doctor_target: parseInt(cfg.doctor_target, 10),
        chemist_target: parseInt(cfg.chemist_target, 10),
        stockist_target: parseInt(cfg.stockist_target, 10),
        total_target: parseInt(cfg.doctor_target, 10) + parseInt(cfg.chemist_target, 10) + parseInt(cfg.stockist_target, 10),
        updated_by: cfg.updated_by,
        created_at: cfg.created_at
      }
    });
  } catch (error) {
    console.error('getDcrSettings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET all saved DCR settings history
 */
const getDcrSettingsHistory = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');

    const rows = await sequelize.query(
      `SELECT ds.*, u.name as updated_by_name
       FROM dcr_settings ds
       LEFT JOIN users u ON ds.updated_by = u.id
       ORDER BY ds.created_at DESC
       LIMIT 50`,
      { type: sequelize.QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getDcrSettingsHistory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST — save a new DCR settings config (inserts new row, keeps history)
 */
const saveDcrSettings = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');
    const userId = req.user?.id || null;

    const { doctor_target, chemist_target, stockist_target } = req.body;

    if (
      doctor_target === undefined || chemist_target === undefined || stockist_target === undefined ||
      isNaN(parseInt(doctor_target)) || isNaN(parseInt(chemist_target)) || isNaN(parseInt(stockist_target))
    ) {
      return res.status(400).json({
        success: false,
        message: 'doctor_target, chemist_target, and stockist_target are required and must be numbers'
      });
    }

    const drT = Math.max(0, parseInt(doctor_target, 10));
    const chT = Math.max(0, parseInt(chemist_target, 10));
    const stT = Math.max(0, parseInt(stockist_target, 10));

    // Ensure table exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS dcr_settings (
        id SERIAL PRIMARY KEY,
        doctor_target INTEGER NOT NULL DEFAULT 10,
        chemist_target INTEGER NOT NULL DEFAULT 5,
        stockist_target INTEGER NOT NULL DEFAULT 2,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await sequelize.query(
      `INSERT INTO dcr_settings (doctor_target, chemist_target, stockist_target, updated_by, created_at)
       VALUES (:drT, :chT, :stT, :userId, NOW())`,
      {
        replacements: { drT, chT, stT, userId },
        type: sequelize.QueryTypes.INSERT
      }
    );

    return res.json({
      success: true,
      message: 'DCR targets saved successfully',
      data: {
        doctor_target: drT,
        chemist_target: chT,
        stockist_target: stT,
        total_target: drT + chT + stT
      }
    });
  } catch (error) {
    console.error('saveDcrSettings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDcrSettings, getDcrSettingsHistory, saveDcrSettings };
