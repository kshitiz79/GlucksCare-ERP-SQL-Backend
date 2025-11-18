// src/stockist/stockistImageController.js

const cloudinary = require('../config/cloudinary');

// Upload a single image to Cloudinary
const uploadImage = async (file) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'stockist_documents',
      resource_type: 'auto', // Changed to 'auto' to support both images and PDFs
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto' }
      ]
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

// Upload multiple images
const uploadImages = async (files) => {
  try {
    const uploadPromises = files.map(file => uploadImage(file));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Cloudinary multi-upload error:', error);
    throw new Error('Failed to upload images to Cloudinary');
  }
};

// Handle stockist document image uploads
const uploadStockistDocuments = async (req, res) => {
  try {
    const { id } = req.params; // Changed from stockistId to id to match the route parameter
    const { Stockist } = req.app.get('models');
    
    // Check if any files were uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    // Find the stockist
    const stockist = await Stockist.findByPk(id); // Changed from stockistId to id
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }
    
    // Upload each file and update the stockist record
    const documentUrls = {};
    
    // Process each file field
    for (const [fieldName, files] of Object.entries(req.files)) {
      if (files && files.length > 0) {
        const file = files[0]; // Take the first file for each field
        const url = await uploadImage(file);
        // Map field names to database column names
        switch (fieldName) {
          case 'gstCertificate':
            documentUrls.gst_certificate_url = url;
            break;
          case 'drugLicense':
            documentUrls.drug_license_url = url;
            break;
          case 'panCard':
            documentUrls.pan_card_url = url;
            break;
          case 'cancelledCheque':
            documentUrls.cancelled_cheque_url = url;
            break;
          case 'businessProfile':
            documentUrls.business_profile_url = url;
            break;
        }
      }
    }
    
    // Update the stockist with document URLs
    await stockist.update(documentUrls);
    
    // Fetch the updated stockist to return with all data
    const updatedStockist = await Stockist.findByPk(id); // Changed from stockistId to id
    
    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      data: updatedStockist
    });
  } catch (error) {
    console.error('Upload stockist documents error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload documents'
    });
  }
};

module.exports = {
  uploadImage,
  uploadImages,
  uploadStockistDocuments
};