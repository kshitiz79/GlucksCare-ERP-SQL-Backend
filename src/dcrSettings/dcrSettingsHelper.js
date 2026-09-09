// src/dcrSettings/dcrSettingsHelper.js
// Provides helper functions for reading global DCR and Visit Geo-Fencing rules

/**
 * Returns active visit distance verification configuration
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Promise<{ enableDistanceVerification: boolean, maxDistanceMeters: number }>}
 */
const getActiveVisitDistanceConfig = async (sequelize) => {
  try {
    const rows = await sequelize.query(
      `SELECT max_visit_distance_meters, enable_distance_verification 
       FROM dcr_settings 
       ORDER BY created_at DESC 
       LIMIT 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    if (rows && rows.length > 0) {
      const cfg = rows[0];
      return {
        enableDistanceVerification: cfg.enable_distance_verification !== false,
        maxDistanceMeters: parseInt(cfg.max_visit_distance_meters, 10) || 200
      };
    }
  } catch (error) {
    console.warn('getActiveVisitDistanceConfig warning:', error.message);
  }

  // Fallback default (200m enabled)
  return {
    enableDistanceVerification: true,
    maxDistanceMeters: 200
  };
};

module.exports = {
  getActiveVisitDistanceConfig
};
