// src/themeSetting/themeColorController.js
const defaultFieldOmniColors = require('./defaultFieldOmniColors');

const getModels = (req) => req?.db || (req?.app && req?.app.get('models')) || require('../config/database');
const getSequelize = (req) => req?.tenantSequelize || (req?.app && req?.app.get('sequelize')) || require('../config/database').sequelize;

/**
 * Ensure table exists and auto-seed if empty
 */
async function ensureThemeColorsSeeded(models, sequelize, themeName = 'FieldOmni') {
  if (!models.ThemeColor) return;
  try {
    const count = await models.ThemeColor.count({
      where: { theme_name: themeName }
    });

    if (count === 0) {
      console.log(`🎨 [ThemeColor] Seeding ${defaultFieldOmniColors.length} default colors for "${themeName}"...`);
      const seedRecords = defaultFieldOmniColors.map(c => ({
        ...c,
        theme_name: themeName,
        is_active: true
      }));

      await models.ThemeColor.bulkCreate(seedRecords, {
        ignoreDuplicates: true
      });
      console.log(`✅ [ThemeColor] Successfully seeded default FieldOmni colors.`);
    }
  } catch (err) {
    console.warn(`⚠️ [ThemeColor] Auto-seed warning:`, err.message);
  }
}

/**
 * GET all theme colors with category groupings and key-value maps
 */
const getThemeColors = async (req, res) => {
  try {
    const models = getModels(req);
    const sequelize = getSequelize(req);
    const { theme = 'FieldOmni', category, search, activeOnly = 'false' } = req.query;

    await ensureThemeColorsSeeded(models, sequelize, theme);

    const whereClause = { theme_name: theme };
    if (activeOnly === 'true') {
      whereClause.is_active = true;
    }
    if (category) {
      whereClause.category = category;
    }

    let colors = await models.ThemeColor.findAll({
      where: whereClause,
      order: [['category', 'ASC'], ['color_key', 'ASC']]
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      colors = colors.filter(c =>
        c.color_key.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        c.color_hex.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }

    // Build Key-Value maps for direct consumption
    const hexMap = {};
    const flutterHexIntMap = {};
    const categorized = {};

    colors.forEach(c => {
      hexMap[c.color_key] = c.color_hex;
      flutterHexIntMap[c.color_key] = c.color_value_hex_int || c.color_hex;

      if (!categorized[c.category]) {
        categorized[c.category] = [];
      }
      categorized[c.category].push(c);
    });

    return res.json({
      success: true,
      theme,
      total: colors.length,
      palette: hexMap,
      flutterPalette: flutterHexIntMap,
      categories: categorized,
      data: colors
    });
  } catch (error) {
    console.error('Error fetching theme colors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve theme colors',
      error: error.message
    });
  }
};

/**
 * GET Flutter TColors compatible JSON object
 */
const getFlutterPalette = async (req, res) => {
  try {
    const models = getModels(req);
    const sequelize = getSequelize(req);
    const { theme = 'FieldOmni' } = req.query;

    await ensureThemeColorsSeeded(models, sequelize, theme);

    const colors = await models.ThemeColor.findAll({
      where: { theme_name: theme, is_active: true }
    });

    const flutterColors = {};
    const hexColors = {};

    colors.forEach(c => {
      flutterColors[c.color_key] = c.color_value_hex_int || c.color_hex;
      hexColors[c.color_key] = c.color_hex;
    });

    return res.json({
      success: true,
      theme,
      colors: flutterColors,
      hexColors
    });
  } catch (error) {
    console.error('Error fetching Flutter palette:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve flutter palette',
      error: error.message
    });
  }
};

/**
 * GET single theme color by key
 */
const getThemeColorByKey = async (req, res) => {
  try {
    const models = getModels(req);
    const { key } = req.params;
    const { theme = 'FieldOmni' } = req.query;

    const color = await models.ThemeColor.findOne({
      where: {
        theme_name: theme,
        color_key: key
      }
    });

    if (!color) {
      return res.status(404).json({
        success: false,
        message: `Color '${key}' not found in theme '${theme}'`
      });
    }

    return res.json({
      success: true,
      data: color
    });
  } catch (error) {
    console.error('Error fetching color by key:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve color',
      error: error.message
    });
  }
};

/**
 * POST /api/theme-colors/seed - Upload / Reset all FieldOmni default colors into database table
 */
const seedFieldOmniColors = async (req, res) => {
  try {
    const models = getModels(req);
    const { theme = 'FieldOmni', overwrite = true } = req.body;

    if (overwrite) {
      await models.ThemeColor.destroy({
        where: { theme_name: theme }
      });
    }

    const records = defaultFieldOmniColors.map(c => ({
      ...c,
      theme_name: theme,
      is_active: true
    }));

    const created = await models.ThemeColor.bulkCreate(records, {
      updateOnDuplicate: ['color_hex', 'color_value_hex_int', 'category', 'description', 'is_active', 'updated_at']
    });

    return res.status(201).json({
      success: true,
      message: `Successfully uploaded and seeded ${created.length} FieldOmni theme colors into database table`,
      theme,
      count: created.length,
      data: created
    });
  } catch (error) {
    console.error('Error seeding theme colors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload theme colors',
      error: error.message
    });
  }
};

/**
 * POST / PUT Upsert a theme color
 */
const upsertThemeColor = async (req, res) => {
  try {
    const models = getModels(req);
    const {
      theme_name = 'FieldOmni',
      color_key,
      color_hex,
      color_value_hex_int,
      category = 'custom',
      description,
      is_active = true
    } = req.body;

    if (!color_key || !color_hex) {
      return res.status(400).json({
        success: false,
        message: 'color_key and color_hex are required'
      });
    }

    const [record, created] = await models.ThemeColor.findOrCreate({
      where: {
        theme_name,
        color_key
      },
      defaults: {
        theme_name,
        color_key,
        color_hex,
        color_value_hex_int: color_value_hex_int || `0xFF${color_hex.replace('#', '').toUpperCase()}`,
        category,
        description,
        is_active
      }
    });

    if (!created) {
      record.color_hex = color_hex;
      if (color_value_hex_int) record.color_value_hex_int = color_value_hex_int;
      if (category) record.category = category;
      if (description !== undefined) record.description = description;
      if (is_active !== undefined) record.is_active = is_active;
      await record.save();
    }

    return res.json({
      success: true,
      message: created ? 'Theme color created successfully' : 'Theme color updated successfully',
      data: record
    });
  } catch (error) {
    console.error('Error saving theme color:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save theme color',
      error: error.message
    });
  }
};

/**
 * DELETE a theme color by ID
 */
const deleteThemeColor = async (req, res) => {
  try {
    const models = getModels(req);
    const { id } = req.params;

    const deleted = await models.ThemeColor.destroy({
      where: { id }
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Theme color not found'
      });
    }

    return res.json({
      success: true,
      message: 'Theme color deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting theme color:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete theme color',
      error: error.message
    });
  }
};

module.exports = {
  getThemeColors,
  getFlutterPalette,
  getThemeColorByKey,
  seedFieldOmniColors,
  upsertThemeColor,
  deleteThemeColor
};
