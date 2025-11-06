// src/invoiceTracking/invoiceTrackingController.js

const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { Readable } = require('stream');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'invoice_tracking',
        public_id: `invoice_${Date.now()}_${filename}`,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(stream);
  });
};

// GET all invoice tracking records
const getAllInvoiceTracking = async (req, res) => {
  try {
    const { InvoiceTracking, Stockist, User } = req.app.get('models');
    const { page = 1, limit = 10, status, stockist_id } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (stockist_id) whereClause.stockist_id = stockist_id;

    const options = {
      where: whereClause,
      include: [
        {
          model: Stockist,
          attributes: ['id', 'firm_name', 'email_address', 'mobile_number', 'registered_office_address']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'updater',
          attributes: ['id', 'name', 'email']
        }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']]
    };

    const { count, rows } = await InvoiceTracking.findAndCountAll(options);

    res.json({
      success: true,
      data: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalCount: count,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoice tracking records:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET invoice tracking records for user (filtered by head office)
const getUserInvoiceTracking = async (req, res) => {
  try {
    const { InvoiceTracking, Stockist, User, HeadOffice } = req.app.get('models');
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    // Get user's head offices
    const user = await User.findByPk(userId, {
      include: [{
        model: HeadOffice,
        as: 'headOffices',
        attributes: ['id']
      }]
    });

    if (!user || !user.headOffices || user.headOffices.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No head office assigned to user'
      });
    }

    const headOfficeIds = user.headOffices.map(ho => ho.id);

    // Find stockists in user's head offices
    const stockists = await Stockist.findAll({
      where: {
        head_office_id: headOfficeIds
      },
      attributes: ['id']
    });

    const stockistIds = stockists.map(s => s.id);

    const whereClause = {
      stockist_id: stockistIds
    };
    if (status) whereClause.status = status;

    const options = {
      where: whereClause,
      include: [
        {
          model: Stockist,
          attributes: ['id', 'firm_name', 'email_address', 'mobile_number', 'registered_office_address']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']]
    };

    const { count, rows } = await InvoiceTracking.findAndCountAll(options);

    res.json({
      success: true,
      data: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalCount: count,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user invoice tracking records:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET invoice tracking by ID
const getInvoiceTrackingById = async (req, res) => {
  try {
    const { InvoiceTracking, Stockist, User } = req.app.get('models');
    const { id } = req.params;

    const invoiceTracking = await InvoiceTracking.findByPk(id, {
      include: [
        {
          model: Stockist,
          attributes: ['id', 'firm_name', 'email_address', 'mobile_number', 'registered_office_address']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'updater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!invoiceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Invoice tracking record not found'
      });
    }

    res.json({
      success: true,
      data: invoiceTracking
    });
  } catch (error) {
    console.error('Error fetching invoice tracking record:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE new invoice tracking record
const createInvoiceTracking = async (req, res) => {
  try {
    const { InvoiceTracking, Stockist } = req.app.get('models');
    const {
      stockist_id,
      invoice_number,
      invoice_date,
      tracking_link,
      awb_number,
      courier_company_name,
      status,
      remarks
    } = req.body;

    // Validate required fields
    if (!stockist_id || !invoice_number || !invoice_date) {
      return res.status(400).json({
        success: false,
        message: 'Stockist ID, invoice number, and invoice date are required'
      });
    }

    // Verify stockist exists
    const stockist = await Stockist.findByPk(stockist_id);
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }

    let invoiceImageUrl = null;
    let invoiceImagePublicId = null;

    // Handle image upload if provided
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          req.file.originalname
        );
        invoiceImageUrl = uploadResult.secure_url;
        invoiceImagePublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(400).json({
          success: false,
          message: 'Failed to upload image'
        });
      }
    }

    const invoiceTrackingData = {
      party_name: stockist.firm_name,
      stockist_id,
      invoice_number,
      invoice_date,
      invoice_image_url: invoiceImageUrl,
      invoice_image_public_id: invoiceImagePublicId,
      tracking_link,
      awb_number,
      courier_company_name,
      status: status || 'pending',
      remarks,
      created_by: req.user.id
    };

    const invoiceTracking = await InvoiceTracking.create(invoiceTrackingData);

    // Fetch the created record with associations
    const createdRecord = await InvoiceTracking.findByPk(invoiceTracking.id, {
      include: [
        {
          model: Stockist,
          attributes: ['id', 'firm_name', 'email_address', 'mobile_number']
        }
      ]
    });

    res.status(201).json({
      success: true,
      data: createdRecord,
      message: 'Invoice tracking record created successfully'
    });
  } catch (error) {
    console.error('Error creating invoice tracking record:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE invoice tracking record
const updateInvoiceTracking = async (req, res) => {
  try {
    const { InvoiceTracking, Stockist } = req.app.get('models');
    const { id } = req.params;
    const {
      stockist_id,
      invoice_number,
      invoice_date,
      tracking_link,
      awb_number,
      courier_company_name,
      status,
      remarks
    } = req.body;

    const invoiceTracking = await InvoiceTracking.findByPk(id);
    if (!invoiceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Invoice tracking record not found'
      });
    }

    let updateData = {
      invoice_number,
      invoice_date,
      tracking_link,
      awb_number,
      courier_company_name,
      status,
      remarks,
      updated_by: req.user.id
    };

    // Handle stockist change
    if (stockist_id && stockist_id !== invoiceTracking.stockist_id) {
      const stockist = await Stockist.findByPk(stockist_id);
      if (!stockist) {
        return res.status(404).json({
          success: false,
          message: 'Stockist not found'
        });
      }
      updateData.stockist_id = stockist_id;
      updateData.party_name = stockist.firm_name;
    }

    // Handle image upload if provided
    if (req.file) {
      try {
        // Delete old image if exists
        if (invoiceTracking.invoice_image_public_id) {
          await cloudinary.uploader.destroy(invoiceTracking.invoice_image_public_id);
        }

        // Upload new image
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          req.file.originalname
        );
        updateData.invoice_image_url = uploadResult.secure_url;
        updateData.invoice_image_public_id = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(400).json({
          success: false,
          message: 'Failed to upload image'
        });
      }
    }

    await invoiceTracking.update(updateData);

    // Fetch updated record with associations
    const updatedRecord = await InvoiceTracking.findByPk(id, {
      include: [
        {
          model: Stockist,
          attributes: ['id', 'firm_name', 'email_address', 'mobile_number']
        }
      ]
    });

    res.json({
      success: true,
      data: updatedRecord,
      message: 'Invoice tracking record updated successfully'
    });
  } catch (error) {
    console.error('Error updating invoice tracking record:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE invoice tracking record
const deleteInvoiceTracking = async (req, res) => {
  try {
    const { InvoiceTracking } = req.app.get('models');
    const { id } = req.params;

    const invoiceTracking = await InvoiceTracking.findByPk(id);
    if (!invoiceTracking) {
      return res.status(404).json({
        success: false,
        message: 'Invoice tracking record not found'
      });
    }

    // Delete image from Cloudinary if exists
    if (invoiceTracking.invoice_image_public_id) {
      try {
        await cloudinary.uploader.destroy(invoiceTracking.invoice_image_public_id);
      } catch (deleteError) {
        console.error('Error deleting image from Cloudinary:', deleteError);
      }
    }

    await invoiceTracking.destroy();

    res.json({
      success: true,
      message: 'Invoice tracking record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice tracking record:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockists for dropdown (admin)
const getStockistsForDropdown = async (req, res) => {
  try {
    const { Stockist } = req.app.get('models');

    const stockists = await Stockist.findAll({
      attributes: ['id', 'firm_name', 'email_address', 'mobile_number'],
      order: [['firm_name', 'ASC']]
    });

    res.json({
      success: true,
      data: stockists
    });
  } catch (error) {
    console.error('Error fetching stockists:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  upload,
  getAllInvoiceTracking,
  getUserInvoiceTracking,
  getInvoiceTrackingById,
  createInvoiceTracking,
  updateInvoiceTracking,
  deleteInvoiceTracking,
  getStockistsForDropdown
};