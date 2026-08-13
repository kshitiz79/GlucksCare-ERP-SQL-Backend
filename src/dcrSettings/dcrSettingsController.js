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
          doctor_frequency: 'daily',
          chemist_target: 5,
          chemist_frequency: 'daily',
          stockist_target: 2,
          stockist_frequency: 'daily',
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
        doctor_frequency: cfg.doctor_frequency || 'daily',
        chemist_target: parseInt(cfg.chemist_target, 10),
        chemist_frequency: cfg.chemist_frequency || 'daily',
        stockist_target: parseInt(cfg.stockist_target, 10),
        stockist_frequency: cfg.stockist_frequency || 'daily',
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

    const {
      doctor_target,
      doctor_frequency = 'daily',
      chemist_target,
      chemist_frequency = 'daily',
      stockist_target,
      stockist_frequency = 'daily'
    } = req.body;

    if (
      doctor_target === undefined || chemist_target === undefined || stockist_target === undefined ||
      isNaN(parseInt(doctor_target)) || isNaN(parseInt(chemist_target)) || isNaN(parseInt(stockist_target))
    ) {
      return res.status(400).json({
        success: false,
        message: 'doctor_target, chemist_target, and stockist_target are required and must be numbers'
      });
    }

    const validFrequencies = ['daily', 'weekly', 'monthly'];
    const drFreq = validFrequencies.includes(doctor_frequency) ? doctor_frequency : 'daily';
    const chFreq = validFrequencies.includes(chemist_frequency) ? chemist_frequency : 'daily';
    const stFreq = validFrequencies.includes(stockist_frequency) ? stockist_frequency : 'daily';

    const drT = Math.max(0, parseInt(doctor_target, 10));
    const chT = Math.max(0, parseInt(chemist_target, 10));
    const stT = Math.max(0, parseInt(stockist_target, 10));

    // Ensure table exists with columns
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS dcr_settings (
        id SERIAL PRIMARY KEY,
        doctor_target INTEGER NOT NULL DEFAULT 10,
        doctor_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
        chemist_target INTEGER NOT NULL DEFAULT 5,
        chemist_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
        stockist_target INTEGER NOT NULL DEFAULT 2,
        stockist_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await sequelize.query(`ALTER TABLE dcr_settings ADD COLUMN IF NOT EXISTS doctor_frequency VARCHAR(20) DEFAULT 'daily';`);
    await sequelize.query(`ALTER TABLE dcr_settings ADD COLUMN IF NOT EXISTS chemist_frequency VARCHAR(20) DEFAULT 'daily';`);
    await sequelize.query(`ALTER TABLE dcr_settings ADD COLUMN IF NOT EXISTS stockist_frequency VARCHAR(20) DEFAULT 'daily';`);

    await sequelize.query(
      `INSERT INTO dcr_settings (doctor_target, doctor_frequency, chemist_target, chemist_frequency, stockist_target, stockist_frequency, updated_by, created_at)
       VALUES (:drT, :drFreq, :chT, :chFreq, :stT, :stFreq, :userId, NOW())`,
      {
        replacements: { drT, drFreq, chT, chFreq, stT, stFreq, userId },
        type: sequelize.QueryTypes.INSERT
      }
    );

    return res.json({
      success: true,
      message: 'DCR targets saved successfully',
      data: {
        doctor_target: drT,
        doctor_frequency: drFreq,
        chemist_target: chT,
        chemist_frequency: chFreq,
        stockist_target: stT,
        stockist_frequency: stFreq,
        total_target: drT + chT + stT
      }
    });
  } catch (error) {
    console.error('saveDcrSettings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDcrSettings, getDcrSettingsHistory, saveDcrSettings };
