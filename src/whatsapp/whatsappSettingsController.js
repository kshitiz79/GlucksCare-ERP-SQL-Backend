// Sql-Backend/src/whatsapp/whatsappSettingsController.js
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE_PATH = path.join(__dirname, '../../../whatsapp_settings.json');

const DEFAULT_SETTINGS = {
  userCreation: {
    campaignName: 'welcome_message_sr',
    templateId: '2c807ad8-584c-477e-905a-46cece539244'
  },
  forwardingNote: {
    campaignName: 'welcome_message_sr',
    templateId: '2c807ad8-584c-477e-905a-46cece539244'
  }
};

/**
 * Load settings helper
 */
const loadSettingsHelper = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[WhatsApp Settings] Error reading settings file:', err);
  }
  return DEFAULT_SETTINGS;
};

/**
 * GET /api/whatsapp/settings
 * Retrieves the current settings
 */
const getSettings = async (req, res) => {
  try {
    const settings = loadSettingsHelper();
    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('[WhatsApp Settings] getSettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve WhatsApp settings'
    });
  }
};

/**
 * POST /api/whatsapp/settings
 * Saves WhatsApp settings
 */
const saveSettings = async (req, res) => {
  try {
    const { userCreation, forwardingNote } = req.body;

    // Basic validation
    if (!userCreation || !forwardingNote) {
      return res.status(400).json({
        success: false,
        message: 'Both userCreation and forwardingNote settings must be provided'
      });
    }

    if (!userCreation.campaignName || !userCreation.templateId) {
      return res.status(400).json({
        success: false,
        message: 'userCreation settings must include campaignName and templateId'
      });
    }

    if (!forwardingNote.campaignName || !forwardingNote.templateId) {
      return res.status(400).json({
        success: false,
        message: 'forwardingNote settings must include campaignName and templateId'
      });
    }

    const newSettings = {
      userCreation: {
        campaignName: userCreation.campaignName.trim(),
        templateId: userCreation.templateId.trim()
      },
      forwardingNote: {
        campaignName: forwardingNote.campaignName.trim(),
        templateId: forwardingNote.templateId.trim()
      }
    };

    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(newSettings, null, 2), 'utf8');

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: newSettings
    });
  } catch (error) {
    console.error('[WhatsApp Settings] saveSettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save WhatsApp settings'
    });
  }
};

module.exports = {
  getSettings,
  saveSettings,
  loadSettingsHelper
};
