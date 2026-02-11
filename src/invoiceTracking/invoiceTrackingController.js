// src/invoiceTracking/invoiceTrackingController.js

const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = require('../config/b2Config');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const nodemailer = require('nodemailer');


// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Helper function to upload image to Cloudinary
// hardened uploadToB2
const uploadToB2 = async (buffer, originalFilename, mimetype = 'application/pdf') => {
  if (!buffer || !(buffer instanceof Buffer)) {
    throw new Error('uploadToB2: invalid buffer provided');
  }
  if (!originalFilename || typeof originalFilename !== 'string') {
    originalFilename = `file_${Date.now()}.pdf`;
  }

  try {
    const fileExtension = path.extname(originalFilename) || '.pdf';
    const fileName = `invoice_${Date.now()}_${uuidv4()}${fileExtension}`;

    const uploadParams = {
      Bucket: process.env.B2_S3_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: mimetype || 'application/pdf',
      Metadata: { 'original-name': originalFilename }
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    // Build public URL robustly.
    // Prefer an explicit PUBLIC_URL env var first (recommended), else derive from endpoint.
    let publicUrl;
    if (process.env.B2_PUBLIC_URL) {
      // allow user to set full public URL like https://f001.backblazeb2.com
      publicUrl = `${process.env.B2_PUBLIC_URL.replace(/\/$/, '')}/${process.env.B2_S3_BUCKET_NAME}/${encodeURIComponent(fileName)}`;
    } else if (process.env.B2_S3_ENDPOINT) {
      // normalize endpoint and avoid calling replace on undefined
      const rawEndpoint = process.env.B2_S3_ENDPOINT;
      // ensure no trailing slash
      const endpointNoSlash = rawEndpoint.replace(/\/+$/, '');
      // If endpoint includes the scheme, keep it; otherwise default to https
      const hasScheme = /^https?:\/\//i.test(endpointNoSlash);
      const base = hasScheme ? endpointNoSlash : `https://${endpointNoSlash}`;
      publicUrl = `${base}/${process.env.B2_S3_BUCKET_NAME}/${encodeURIComponent(fileName)}`;
    } else {
      // fallback to a path-like return (no URL)
      publicUrl = null;
      console.warn('uploadToB2: no B2_PUBLIC_URL or B2_S3_ENDPOINT configured - public URL cannot be constructed');
    }

    return { secure_url: publicUrl, public_id: fileName };
  } catch (error) {
    console.error('B2 upload error:', error);
    // throw a new Error with context (preserve stack)
    throw error;
  }
};


const deleteFromB2 = async (fileKey) => {
  try {
    const deleteParams = { Bucket: process.env.B2_S3_BUCKET_NAME, Key: fileKey };
    await s3Client.send(new DeleteObjectCommand(deleteParams));
  } catch (error) {
    console.error('B2 delete error:', error);
    throw error;
  }
};

const { Op } = require('sequelize');

// GET all invoice tracking records
const getAllInvoiceTracking = async (req, res) => {
  try {
    const { InvoiceTracking, Stockist, User } = req.app.get('models');
    const {
      page = 1,
      limit = 10,
      status,
      stockist_id,
      startDate,
      endDate,
      search
    } = req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (stockist_id) whereClause.stockist_id = stockist_id;

    // Date range filtering
    if (startDate && endDate) {
      whereClause.invoice_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.invoice_date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.invoice_date = {
        [Op.lte]: endDate
      };
    }

    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { invoice_number: { [Op.like]: `%${search}%` } },
        { party_name: { [Op.like]: `%${search}%` } },
        { remarks: { [Op.like]: `%${search}%` } }
      ];
    }

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
      order: [['invoice_date', 'DESC'], ['created_at', 'DESC']]
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
    const {
      page = 1,
      limit = 10,
      status,
      stockist_id,
      startDate,
      endDate,
      search
    } = req.query;

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
    const stockistWhere = {
      head_office_id: headOfficeIds
    };
    if (stockist_id) {
      stockistWhere.id = stockist_id;
    }

    const stockists = await Stockist.findAll({
      where: stockistWhere,
      attributes: ['id']
    });

    const stockistIds = stockists.map(s => s.id);

    const whereClause = {
      stockist_id: stockistIds
    };
    if (status) whereClause.status = status;

    // Date range filtering
    if (startDate && endDate) {
      whereClause.invoice_date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.invoice_date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.invoice_date = {
        [Op.lte]: endDate
      };
    }

    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { invoice_number: { [Op.like]: `%${search}%` } },
        { party_name: { [Op.like]: `%${search}%` } },
        { remarks: { [Op.like]: `%${search}%` } }
      ];
    }

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
      order: [['invoice_date', 'DESC'], ['created_at', 'DESC']]
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
      remarks,
      amount
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
        const uploadResult = await uploadToB2(
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
      amount,
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
    const { InvoiceTracking, Stockist, ForwardingNote } = req.app.get('models');
    const { id } = req.params;
    const {
      stockist_id,
      invoice_number,
      invoice_date,
      tracking_link,
      awb_number,
      courier_company_name,
      status,
      remarks,
      amount
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
      amount,
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
          await deleteFromB2(invoiceTracking.invoice_image_public_id);
        }

        // Upload new image
        const uploadResult = await uploadToB2(
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

    // Sync amount to forwarding notes if amount has changed
    if (amount !== undefined) {
      await ForwardingNote.update(
        { amount: amount },
        { where: { invoice_tracking_id: id } }
      );
    }

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
        await deleteFromB2(invoiceTracking.invoice_image_public_id);
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

// at top of invoiceTrackingController.js ensure these are available


// s3Client is already required earlier as: const s3Client = require('../config/b2Config');

const getInvoiceSignedUrl = async (req, res) => {
  try {
    const { InvoiceTracking } = req.app.get('models');
    const { id } = req.params;

    const record = await InvoiceTracking.findByPk(id);
    if (!record || !record.invoice_image_public_id) {
      return res.status(404).json({ success: false, message: 'Invoice file not found' });
    }

    const key = record.invoice_image_public_id; // this is the Key you saved on upload
    if (!key) {
      return res.status(500).json({ success: false, message: 'File key missing' });
    }

    const getObjectParams = {
      Bucket: process.env.B2_S3_BUCKET_NAME,
      Key: key
    };

    const command = new GetObjectCommand(getObjectParams);

    // 15 minutes validity (adjust as needed)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // very small sanity check
    if (!signedUrl || typeof signedUrl !== 'string') {
      console.error('Invalid signedUrl generated:', signedUrl);
      return res.status(500).json({ success: false, message: 'Failed to generate signed URL' });
    }

    return res.json({ success: true, url: signedUrl });
  } catch (err) {
    console.error('Error generating invoice signed url:', err);
    res.status(500).json({ success: false, message: 'Could not create download URL' });
  }
};

const sendInvoiceEmail = async (req, res) => {
  try {
    const { InvoiceTracking, Stockist } = req.app.get('models');
    const { id } = req.params;

    const invoice = await InvoiceTracking.findByPk(id, {
      include: [
        {
          model: Stockist,
          attributes: ['id', 'firm_name', 'email_address', 'mobile_number']
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (!invoice.Stockist?.email_address) {
      return res.status(400).json({ success: false, message: 'Stockist email not found' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com',
        pass: process.env.EMAIL_PASS || 'ldgmqixyufjdzylv',
      },
    });

    let attachment = [];
    if (invoice.invoice_image_public_id) {
      const getObjectParams = {
        Bucket: process.env.B2_S3_BUCKET_NAME,
        Key: invoice.invoice_image_public_id
      };
      const command = new GetObjectCommand(getObjectParams);
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

      attachment.push({
        filename: `Invoice_${invoice.invoice_number}.pdf`,
        path: signedUrl
      });
    }

    const mailOptions = {
      from: '"GlucksCare ERP" <care@gluckscare.com>',
      to: invoice.Stockist.email_address,
      subject: `invoice - ${invoice.invoice_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
          <p>Dear ${invoice.Stockist.firm_name},</p>
          <p>Greetings from <strong>Gluckscare Pharmaceuticals</strong>.</p>
          <p>Please find attached the invoice for the medicines supplied to you.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
            <p style="margin: 5px 0 0 0;"><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</p>
            <p style="margin: 5px 0 0 0;"><strong>Invoice Amount:</strong> ₹${invoice.amount?.toLocaleString('en-IN')}</p>
          </div>
          <p>Kindly verify the details and let us know if any clarification is required.</p>
          <p>Thank you for your continued association with Gluckscare Pharmaceuticals.</p>
          <p style="margin-top: 30px;">
            Warm regards,<br>
            <strong>Accounts Team</strong><br>
            Gluckscare Pharmaceuticals
          </p>
        </div>
      `,
      attachments: attachment
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Invoice email sent:', info.response);

    res.json({
      success: true,
      message: `Invoice sent to ${invoice.Stockist.email_address} successfully`
    });

  } catch (error) {
    console.error('Error sending invoice email:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
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
  getStockistsForDropdown,
  getInvoiceSignedUrl,
  sendInvoiceEmail
};