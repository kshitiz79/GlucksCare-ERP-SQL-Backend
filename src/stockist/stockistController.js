// GET all stockists
const getAllStockists = async (req, res) => {
  try {
    const { Stockist, HeadOffice, StockistAnnualTurnover } = req.app.get('models');

    const stockists = await Stockist.findAll({
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: StockistAnnualTurnover,
          as: 'AnnualTurnovers',
          attributes: ['year', 'amount']
        }
      ]
    });

    // Transform the response to match the MongoDB format
    const transformedStockists = stockists.map(stockist => {
      const stockistObj = stockist.toJSON();
      return {
        ...stockistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
        _id: stockistObj.id,
        createdAt: stockistObj.created_at,
        updatedAt: stockistObj.updated_at,
        geo_image_status: !!stockistObj.geo_image_url,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };
    });

    res.json({
      success: true,
      count: transformedStockists.length,
      data: transformedStockists
    });
  } catch (error) {
    console.error('Error in getAllStockists:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockist by ID
const getStockistById = async (req, res) => {
  try {
    const { Stockist, HeadOffice, StockistAnnualTurnover } = req.app.get('models');

    const stockist = await Stockist.findByPk(req.params.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: StockistAnnualTurnover,
          as: 'AnnualTurnovers',
          attributes: ['year', 'amount']
        }
      ]
    });

    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }

    // Transform the response to match the MongoDB format
    const stockistObj = stockist.toJSON();
    const transformedStockist = {
      ...stockistObj,
      // Convert annual_turnover to the format expected by the frontend
      annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
        year: turnover.year,
        amount: parseFloat(turnover.amount)
      })) : [],
      headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
      _id: stockistObj.id,
      createdAt: stockistObj.created_at,
      updatedAt: stockistObj.updated_at,
      geo_image_status: !!stockistObj.geo_image_url,
      // Remove the nested objects
      AnnualTurnovers: undefined,
      HeadOffice: undefined
    };

    res.json({
      success: true,
      data: transformedStockist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new stockist with optional document upload
const createStockist = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    if (!models || !models.Stockist || !models.HeadOffice || !models.StockistAnnualTurnover || !sequelize) {
      throw new Error('Required models or Sequelize instance are not available');
    }
    const { Stockist, HeadOffice, StockistAnnualTurnover } = models;

    // Log the incoming request body for debugging
    console.log('Incoming stockist data:', JSON.stringify(req.body, null, 2));

    // Process the incoming data
    const stockistData = { ...req.body };

    // Handle head office ID field conversion
    // The frontend might send headOfficeId, head_office_id, or headOffice
    if (stockistData.headOfficeId) {
      // Keep as is for Sequelize model - this is the correct field name
      console.log('Using headOfficeId as is:', stockistData.headOfficeId);
    } else if (stockistData.head_office_id) {
      // Convert database column name to model field name
      stockistData.headOfficeId = stockistData.head_office_id;
      delete stockistData.head_office_id;
      console.log('Converted head_office_id to headOfficeId:', stockistData.headOfficeId);
    } else if (stockistData.headOffice) {
      // Convert alternative field name to model field name
      stockistData.headOfficeId = stockistData.headOffice;
      delete stockistData.headOffice;
      console.log('Converted headOffice to headOfficeId:', stockistData.headOfficeId);
    }

    // Handle field name conversions from camelCase to snake_case
    const fieldMappings = {
      firmName: 'firm_name',
      registeredBusinessName: 'registered_business_name',
      natureOfBusiness: 'nature_of_business',
      gstNumber: 'gst_number',
      drugLicenseNumber: 'drug_license_number',
      panNumber: 'pan_number',
      registeredOfficeAddress: 'registered_office_address',
      contactPerson: 'contact_person',
      mobileNumber: 'mobile_number',
      emailAddress: 'email_address',
      yearsInBusiness: 'years_in_business',
      areasOfOperation: 'areas_of_operation',
      currentPharmaDistributorships: 'current_pharma_distributorships',
      warehouseFacility: 'warehouse_facility',
      storageFacilitySize: 'storage_facility_size',
      coldStorageAvailable: 'cold_storage_available',
      numberOfSalesRepresentatives: 'number_of_sales_representatives',
      bankDetails: 'bank_details',
      headOfficeId: 'head_office_id',
      gstCertificateUrl: 'gst_certificate_url',
      drugLicenseUrl: 'drug_license_url',
      panCardUrl: 'pan_card_url',
      cancelledChequeUrl: 'cancelled_cheque_url',
      businessProfileUrl: 'business_profile_url'
    };

    // Convert field names and collect data for the main stockist record
    const stockistRecordData = {};
    Object.keys(stockistData).forEach(key => {
      // Skip annualTurnover as it will be handled separately
      if (key === 'annualTurnover') return;

      const dbFieldName = fieldMappings[key] || key;
      stockistRecordData[dbFieldName] = stockistData[key];
    });

    // Validate that headOfficeId is provided
    if (!stockistRecordData.head_office_id) {
      return res.status(400).json({
        success: false,
        message: 'Head Office ID is required'
      });
    }

    // Validate that firmName is provided
    if (!stockistRecordData.firm_name) {
      return res.status(400).json({
        success: false,
        message: 'Firm Name is required'
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      console.log('Creating stockist with data:', stockistRecordData);
      const stockist = await Stockist.create(stockistRecordData, { transaction });
      console.log('Stockist created successfully:', stockist.id);

      // Handle annual turnover data if provided
      if (stockistData.annualTurnover && Array.isArray(stockistData.annualTurnover) && stockistData.annualTurnover.length > 0) {
        // Create annual turnover records
        const annualTurnoverRecords = stockistData.annualTurnover.map(turnover => ({
          stockist_id: stockist.id,
          year: parseInt(turnover.year, 10),
          amount: parseFloat(turnover.amount)
        })).filter(turnover => !isNaN(turnover.year) && !isNaN(turnover.amount));

        if (annualTurnoverRecords.length > 0) {
          await StockistAnnualTurnover.bulkCreate(annualTurnoverRecords, { transaction });
        }
      }

      // Handle document uploads if files are provided
      console.log('Checking for file uploads...');
      console.log('req.files:', req.files);
      console.log('Number of files:', req.files ? Object.keys(req.files).length : 0);

      if (req.files && Object.keys(req.files).length > 0) {
        console.log('Processing document uploads for stockist:', stockist.id);
        console.log('File fields received:', Object.keys(req.files));

        // Import the uploadImage function from stockistImageController
        const { uploadImage } = require('./stockistImageController');

        // Upload each file and update the stockist record
        const documentUrls = {};

        // Process each file field
        for (const [fieldName, files] of Object.entries(req.files)) {
          console.log(`Processing field: ${fieldName}, files count: ${files.length}`);
          if (files && files.length > 0) {
            const file = files[0]; // Take the first file for each field
            console.log(`Uploading ${fieldName}:`, {
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size
            });

            try {
              const url = await uploadImage(file);
              console.log(`Successfully uploaded ${fieldName} to:`, url);

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
            } catch (uploadError) {
              console.error(`Error uploading ${fieldName}:`, uploadError);
              // Continue with other files even if one fails
            }
          }
        }

        console.log('Document URLs to update:', documentUrls);

        // Update the stockist with document URLs
        if (Object.keys(documentUrls).length > 0) {
          await stockist.update(documentUrls, { transaction });
          console.log('Stockist updated with document URLs');
        }
      } else {
        console.log('No files received in request');
      }

      // Fetch the created stockist with associations
      const createdStockist = await Stockist.findByPk(stockist.id, {
        include: [
          {
            model: HeadOffice,
            as: 'HeadOffice',
            attributes: ['id', 'name']
          },
          {
            model: StockistAnnualTurnover,
            as: 'AnnualTurnovers',
            attributes: ['year', 'amount']
          }
        ],
        transaction
      });

      // Commit the transaction
      await transaction.commit();

      // Transform the response to match the MongoDB format
      const stockistObj = createdStockist.toJSON();
      const transformedStockist = {
        ...stockistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        annualTurnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
        _id: stockistObj.id,
        createdAt: stockistObj.created_at,
        updatedAt: stockistObj.updated_at,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };

      res.status(201).json({
        success: true,
        data: transformedStockist
      });
    } catch (error) {
      // Rollback the transaction in case of error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Create stockist error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a stockist
const updateStockist = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    if (!models || !models.Stockist || !models.HeadOffice || !models.StockistAnnualTurnover || !sequelize) {
      throw new Error('Required models or Sequelize instance are not available');
    }
    const { Stockist, HeadOffice, StockistAnnualTurnover } = models;

    const stockist = await Stockist.findByPk(req.params.id);
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }

    // Handle geo_image upload if file is provided
    let uploadedImageUrl = null;
    if (req.file) {
      console.log('Processing geo_image upload for update...');
      const cloudinary = require('../config/cloudinary');

      try {
        const result = await new Promise((resolve, reject) => {
          const upload_stream = cloudinary.uploader.upload_stream(
            {
              folder: 'stockist_geo_images',
              resource_type: 'auto',
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto' }
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
          upload_stream.end(req.file.buffer);
        });

        uploadedImageUrl = result.secure_url;
        console.log('Geo-image uploaded to Cloudinary:', result.secure_url);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Continue with stockist update even if image upload fails
      }
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Map headOffice to head_office_id if needed
      const stockistData = { ...req.body };
      if (stockistData.headOffice && !stockistData.head_office_id) {
        stockistData.head_office_id = stockistData.headOffice;
        delete stockistData.headOffice;
      }

      // Handle field name conversions from camelCase to snake_case
      const fieldMappings = {
        firmName: 'firm_name',
        registeredBusinessName: 'registered_business_name',
        natureOfBusiness: 'nature_of_business',
        gstNumber: 'gst_number',
        drugLicenseNumber: 'drug_license_number',
        panNumber: 'pan_number',
        registeredOfficeAddress: 'registered_office_address',
        contactPerson: 'contact_person',
        mobileNumber: 'mobile_number',
        emailAddress: 'email_address',
        yearsInBusiness: 'years_in_business',
        areasOfOperation: 'areas_of_operation',
        currentPharmaDistributorships: 'current_pharma_distributorships',
        warehouseFacility: 'warehouse_facility',
        storageFacilitySize: 'storage_facility_size',
        coldStorageAvailable: 'cold_storage_available',
        numberOfSalesRepresentatives: 'number_of_sales_representatives',
        bankDetails: 'bank_details',
        headOfficeId: 'head_office_id',
        gstCertificateUrl: 'gst_certificate_url',
        drugLicenseUrl: 'drug_license_url',
        panCardUrl: 'pan_card_url',
        cancelledChequeUrl: 'cancelled_cheque_url',
        businessProfileUrl: 'business_profile_url'
      };

      // Convert field names and collect data for the main stockist record
      const stockistUpdateData = {};
      Object.keys(stockistData).forEach(key => {
        // Skip annualTurnover as it will be handled separately
        if (key === 'annualTurnover') return;

        const dbFieldName = fieldMappings[key] || key;
        stockistUpdateData[dbFieldName] = stockistData[key];
      });

      // Add uploaded image URL if available
      if (uploadedImageUrl) {
        stockistUpdateData.geo_image_url = uploadedImageUrl;
      }

      await stockist.update(stockistUpdateData, { transaction });

      // Handle annual turnover data if provided
      if ('annualTurnover' in stockistData) {
        // Delete existing annual turnover records
        await StockistAnnualTurnover.destroy({
          where: { stockist_id: stockist.id },
          transaction
        });

        // Create new annual turnover records if provided
        if (stockistData.annualTurnover && Array.isArray(stockistData.annualTurnover) && stockistData.annualTurnover.length > 0) {
          const annualTurnoverRecords = stockistData.annualTurnover.map(turnover => ({
            stockist_id: stockist.id,
            year: parseInt(turnover.year, 10),
            amount: parseFloat(turnover.amount)
          })).filter(turnover => !isNaN(turnover.year) && !isNaN(turnover.amount));

          if (annualTurnoverRecords.length > 0) {
            await StockistAnnualTurnover.bulkCreate(annualTurnoverRecords, { transaction });
          }
        }
      }

      // Fetch the updated stockist with associations
      const updatedStockist = await Stockist.findByPk(stockist.id, {
        include: [
          {
            model: HeadOffice,
            as: 'HeadOffice',
            attributes: ['id', 'name']
          },
          {
            model: StockistAnnualTurnover,
            as: 'AnnualTurnovers',
            attributes: ['year', 'amount']
          }
        ],
        transaction
      });

      // Commit the transaction
      await transaction.commit();

      // Transform the response to match the MongoDB format
      const stockistObj = updatedStockist.toJSON();
      const transformedStockist = {
        ...stockistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        annualTurnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
        _id: stockistObj.id,
        createdAt: stockistObj.created_at,
        updatedAt: stockistObj.updated_at,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };

      res.json({
        success: true,
        data: transformedStockist
      });
    } catch (error) {
      // Rollback the transaction in case of error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Update stockist error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a stockist
const deleteStockist = async (req, res) => {
  try {
    const { Stockist } = req.app.get('models');
    const stockist = await Stockist.findByPk(req.params.id);
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }

    await stockist.destroy();
    res.json({
      success: true,
      message: 'Stockist deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockists by head office ID
const getStockistsByHeadOffice = async (req, res) => {
  try {
    const { Stockist } = req.app.get('models');
    const { headOfficeId } = req.params;
    const stockists = await Stockist.findAll({
      where: {
        head_office_id: headOfficeId
      }
    });
    res.json(stockists);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockists for current user's head offices
const getMyStockists = async (req, res) => {
  try {
    const { Stockist, HeadOffice, User, StockistAnnualTurnover } = req.app.get('models');

    // Get the current user with their head offices
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] } // Don't include junction table attributes
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all user's head office IDs
    let headOfficeIds = [];

    if (user.headOffices && user.headOffices.length > 0) {
      headOfficeIds = user.headOffices.map(office => office.id);
    } else if (user.head_office_id) {
      headOfficeIds = [user.head_office_id];
    }

    if (headOfficeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No head office assigned to your account. Please contact an administrator.'
      });
    }

    // Find all stockists assigned to user's head offices
    const stockists = await Stockist.findAll({
      where: {
        head_office_id: { [require('sequelize').Op.in]: headOfficeIds }
      },
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: StockistAnnualTurnover,
          as: 'AnnualTurnovers',
          attributes: ['year', 'amount']
        }
      ]
    });

    // Transform the response to match the MongoDB format
    const transformedStockists = stockists.map(stockist => {
      const stockistObj = stockist.toJSON();
      return {
        ...stockistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: stockistObj.AnnualTurnovers ? stockistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
        _id: stockistObj.id,
        createdAt: stockistObj.created_at,
        updatedAt: stockistObj.updated_at,
        geo_image_status: !!stockistObj.geo_image_url,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };
    });

    res.json({
      success: true,
      count: transformedStockists.length,
      data: transformedStockists
    });
  } catch (error) {
    console.error('Get my stockists error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Bulk create stockists
const createBulkStockists = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Stockist || !models.HeadOffice) {
      throw new Error('Required models are not available');
    }
    const { Stockist, HeadOffice } = models;

    // Validate request body
    if (!req.body.stockists || !Array.isArray(req.body.stockists)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must contain a "stockists" array'
      });
    }

    const stockistsData = req.body.stockists;
    if (stockistsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Stockists array cannot be empty'
      });
    }

    if (stockistsData.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create more than 100 stockists at once'
      });
    }

    console.log(`Creating ${stockistsData.length} stockists in bulk...`);

    // Process and validate each stockist data
    const processedStockists = [];
    const errors = [];

    for (let i = 0; i < stockistsData.length; i++) {
      const stockistData = { ...stockistsData[i] };
      try {
        // Handle head office ID field conversion
        if (stockistData.headOfficeId) {
          stockistData.head_office_id = stockistData.headOfficeId;
          delete stockistData.headOfficeId;
        } else if (stockistData.head_office_id) {
          // Keep as is
        } else if (stockistData.headOffice) {
          stockistData.head_office_id = stockistData.headOffice;
          delete stockistData.headOffice;
        }

        // Validate required fields
        if (!stockistData.firm_name) {
          errors.push(`Stockist ${i + 1}: Firm name is required`);
          continue;
        }
        if (!stockistData.head_office_id) {
          errors.push(`Stockist ${i + 1}: Head Office ID is required`);
          continue;
        }

        // Add index for tracking
        stockistData._index = i + 1;
        processedStockists.push(stockistData);
      } catch (error) {
        errors.push(`Stockist ${i + 1}: ${error.message}`);
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found',
        errors: errors,
        validStockists: processedStockists.length,
        totalStockists: stockistsData.length
      });
    }

    // Create stockists in bulk using transaction
    const sequelize = req.app.get('sequelize');
    const transaction = await sequelize.transaction();

    try {
      // Remove _index before creating
      const cleanStockistsData = processedStockists.map(stockist => {
        const { _index, ...cleanData } = stockist;
        return cleanData;
      });

      // Bulk create stockists
      const createdStockists = await Stockist.bulkCreate(cleanStockistsData, {
        transaction,
        returning: true,
        validate: true
      });

      await transaction.commit();
      console.log(`Successfully created ${createdStockists.length} stockists`);

      // Fetch created stockists with associations
      const stockistIds = createdStockists.map(stockist => stockist.id);
      const stockistsWithAssociations = await Stockist.findAll({
        where: {
          id: { [require('sequelize').Op.in]: stockistIds }
        },
        include: [{
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        }]
      });

      // Transform the response
      const transformedStockists = stockistsWithAssociations.map(stockist => {
        const stockistObj = stockist.toJSON();
        return {
          ...stockistObj,
          headOffice: stockistObj.HeadOffice || stockistObj.headOffice,
          _id: stockistObj.id,
          createdAt: stockistObj.created_at,
          updatedAt: stockistObj.updated_at,
          HeadOffice: undefined
        };
      });

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdStockists.length} stockists`,
        count: createdStockists.length,
        data: transformedStockists
      });
    } catch (createError) {
      await transaction.rollback();
      console.error('Bulk create error:', createError);
      res.status(400).json({
        success: false,
        message: 'Failed to create stockists',
        error: createError.message
      });
    }
  } catch (error) {
    console.error('Bulk create stockists error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllStockists,
  getStockistById,
  createStockist,
  updateStockist,
  deleteStockist,
  getStockistsByHeadOffice,
  getMyStockists,
  createBulkStockists
};




