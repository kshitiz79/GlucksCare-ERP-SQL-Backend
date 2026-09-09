// src/companySetting/companySettingController.js

const cloudinary = require('../config/cloudinary');

// Get current Company Settings (Public / Authenticated)
const getCompanySettings = async (req, res) => {
  try {
    const { CompanySetting } = req.app.get('models');
    
    let settings = await CompanySetting.findOne({
      order: [['id', 'ASC']]
    });

    if (!settings) {
      settings = await CompanySetting.create({
        companyName: 'Gluckscare Pharmaceuticals',
        logoUrl: '/login/logo.png',
        tagline: 'Healthcare & Pharmaceutical ERP'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: settings.id,
        companyName: settings.companyName,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        tagline: settings.tagline,
        updatedAt: settings.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company settings',
      error: error.message
    });
  }
};

// Update Company Settings (Admin only)
const updateCompanySettings = async (req, res) => {
  try {
    const { CompanySetting } = req.app.get('models');
    const { companyName, logoUrl, faviconUrl, tagline } = req.body;

    let settings = await CompanySetting.findOne({
      order: [['id', 'ASC']]
    });

    if (!settings) {
      settings = await CompanySetting.create({
        companyName: companyName?.trim() || 'Gluckscare Pharmaceuticals',
        logoUrl: logoUrl || '/login/logo.png',
        faviconUrl: faviconUrl || null,
        tagline: tagline || null,
        updatedBy: req.user?.id || null
      });
    } else {
      await settings.update({
        companyName: companyName !== undefined ? companyName.trim() : settings.companyName,
        logoUrl: logoUrl !== undefined ? logoUrl : settings.logoUrl,
        faviconUrl: faviconUrl !== undefined ? faviconUrl : settings.faviconUrl,
        tagline: tagline !== undefined ? tagline : settings.tagline,
        updatedBy: req.user?.id || settings.updatedBy
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Company settings updated successfully',
      data: {
        id: settings.id,
        companyName: settings.companyName,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        tagline: settings.tagline,
        updatedAt: settings.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating company settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update company settings',
      error: error.message
    });
  }
};

// Upload Company Logo directly to Cloudinary
const uploadCompanyLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No logo image file provided'
      });
    }

    // Upload buffer to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'company_branding',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      stream.end(req.file.buffer);
    });

    return res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      url: uploadResult.secure_url
    });
  } catch (error) {
    console.error('Error uploading company logo:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload logo to Cloudinary',
      error: error.message
    });
  }
};

module.exports = {
  getCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo
};
