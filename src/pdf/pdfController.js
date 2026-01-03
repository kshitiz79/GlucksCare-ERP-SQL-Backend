// controllers/pdfController.js
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Multer configuration for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Middleware for file upload
const uploadMiddleware = upload.single('pdf');

// GET all PDF files
const getAllPdfFiles = async (req, res) => {
  try {
    const PdfFile = req.app.get('models').PdfFile;
    const pdfFiles = await PdfFile.findAll({
      order: [['created_at', 'DESC']],
      include: [
        {
          model: req.app.get('models').User,
          as: 'uploader',
          attributes: ['id', 'name', 'email']
        },
        {
          model: req.app.get('models').Product,
          as: 'product',
          attributes: ['id', 'name', 'image']
        }
      ]
    });

    // Fix URL for existing files that don't have the protocol
    const fixedPdfFiles = pdfFiles.map(pdf => {
      const pdfData = pdf.toJSON();
      if (pdfData.file_url && !pdfData.file_url.startsWith('http')) {
        pdfData.file_url = `https://${pdfData.file_url}`;
      }
      return pdfData;
    });

    res.json({
      success: true,
      count: pdfFiles.length,
      data: fixedPdfFiles
    });
  } catch (error) {
    console.error('Error in getAllPdfFiles:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET PDF file by ID (metadata)
const getPdfFileById = async (req, res) => {
  try {
    const PdfFile = req.app.get('models').PdfFile;
    const pdfFile = await PdfFile.findByPk(req.params.id, {
      include: [
        {
          model: req.app.get('models').User,
          as: 'uploader',
          attributes: ['id', 'name', 'email']
        },
        {
          model: req.app.get('models').Product,
          as: 'product',
          attributes: ['id', 'name', 'image']
        }
      ]
    });

    if (!pdfFile) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found'
      });
    }

    const pdfData = pdfFile.toJSON();
    if (pdfData.file_url && !pdfData.file_url.startsWith('http')) {
      pdfData.file_url = `https://${pdfData.file_url}`;
    }

    res.json({
      success: true,
      data: pdfData
    });
  } catch (error) {
    console.error('Error in getPdfFileById:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new PDF file (upload to B2)
const createPdfFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No PDF file uploaded'
      });
    }

    const { title, description, type, product_id } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: 'Type is required' });
    }

    const PdfFile = req.app.get('models').PdfFile;
    const s3Client = require('../config/b2Config');

    const fileExtension = path.extname(req.file.originalname) || '.pdf';
    const fileName = `${uuidv4()}${fileExtension}`;

    const uploadParams = {
      Bucket: process.env.B2_S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        'original-name': req.file.originalname
      }
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    // Keep stored file_url as an internal URL or placeholder; do NOT rely on it being publicly accessible if bucket is private
    const publicUrl = `https://${process.env.B2_S3_ENDPOINT.replace(/^https?:\/\//, '')}/${process.env.B2_S3_BUCKET_NAME}/${fileName}`;

    const pdfData = {
      title,
      description: description || '',
      file_url: publicUrl,
      file_key: fileName,
      type,
      product_id: product_id || null
    };

    if (req.user && req.user.id) pdfData.uploaded_by = req.user.id;

    const pdfFile = await PdfFile.create(pdfData);

    res.status(201).json({
      success: true,
      message: 'PDF file uploaded successfully',
      data: pdfFile
    });
  } catch (error) {
    console.error('Error in createPdfFile:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a PDF file (metadata)
const updatePdfFile = async (req, res) => {
  try {
    const PdfFile = req.app.get('models').PdfFile;
    const pdfFile = await PdfFile.findByPk(req.params.id);

    if (!pdfFile) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found'
      });
    }

    const { title, description, type, product_id } = req.body;

    if (title !== undefined) pdfFile.title = title;
    if (description !== undefined) pdfFile.description = description;
    if (type !== undefined) {
      // Validate type
      if (type !== 'pdf' && type !== 'brochure') {
        return res.status(400).json({
          success: false,
          message: 'Invalid type. Must be either "pdf" or "brochure"'
        });
      }
      pdfFile.type = type;
    }
    if (product_id !== undefined) pdfFile.product_id = product_id || null;

    await pdfFile.save();

    res.json({
      success: true,
      message: 'PDF file updated successfully',
      data: pdfFile
    });
  } catch (error) {
    console.error('Error in updatePdfFile:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a PDF file (remove from B2 and DB)
const deletePdfFile = async (req, res) => {
  try {
    const PdfFile = req.app.get('models').PdfFile;
    const pdfFile = await PdfFile.findByPk(req.params.id);

    if (!pdfFile) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found'
      });
    }

    const s3Client = require('../config/b2Config');
    const deleteParams = {
      Bucket: process.env.B2_S3_BUCKET_NAME,
      Key: pdfFile.file_key
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));
    await pdfFile.destroy();

    res.json({ success: true, message: 'PDF file deleted successfully' });
  } catch (error) {
    console.error('Error in deletePdfFile:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// NEW: Return a presigned GET URL valid for a short time
const getPdfSignedUrl = async (req, res) => {
  try {
    const PdfFile = req.app.get('models').PdfFile;
    const pdfFile = await PdfFile.findByPk(req.params.id);
    if (!pdfFile) {
      console.error('getPdfSignedUrl: PDF not found for id', req.params.id);
      return res.status(404).json({ success: false, message: 'PDF file not found' });
    }

    console.log('getPdfSignedUrl: found DB record:', {
      id: pdfFile.id,
      file_key: pdfFile.file_key,
      file_url: pdfFile.file_url
    });

    const s3Client = require('../config/b2Config');

    if (!process.env.B2_S3_BUCKET_NAME) {
      console.error('Env error: B2_S3_BUCKET_NAME not set');
      return res.status(500).json({ success: false, message: 'Server misconfiguration: bucket name missing' });
    }

    if (!pdfFile.file_key) {
      console.error('getPdfSignedUrl: pdfFile.file_key is empty for id', pdfFile.id);
      return res.status(500).json({ success: false, message: 'File key missing in DB' });
    }

    const getObjectParams = {
      Bucket: process.env.B2_S3_BUCKET_NAME,
      Key: pdfFile.file_key
    };

    console.log('getPdfSignedUrl: presign params:', getObjectParams);

    const command = new GetObjectCommand(getObjectParams);

    let signedUrl;
    try {
      signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    } catch (presignErr) {
      console.error('Presigner error:', presignErr && presignErr.message ? presignErr.message : presignErr);
      // return safe, descriptive error to client
      return res.status(500).json({ success: false, message: `Presigner failed: ${presignErr.message || presignErr}` });
    }

    console.log('Generated signedUrl (first 200 chars):', String(signedUrl).slice(0, 200));
    // Basic sanity check
    if (typeof signedUrl !== 'string' || !/^https?:\/\//i.test(signedUrl)) {
      console.error('getPdfSignedUrl: generated signedUrl invalid:', signedUrl);
      return res.status(500).json({ success: false, message: 'Generated signed URL is invalid' });
    }

    res.json({
      success: true,
      data: {
        id: pdfFile.id,
        title: pdfFile.title,
        description: pdfFile.description,
        signedUrl
      }
    });
  } catch (error) {
    console.error('Error in getPdfSignedUrl (unexpected):', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = {
  getAllPdfFiles,
  getPdfFileById,
  createPdfFile,
  updatePdfFile,
  deletePdfFile,
  uploadMiddleware,
  getPdfSignedUrl
};
