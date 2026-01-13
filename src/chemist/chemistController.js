const { DataTypes } = require('sequelize');

// GET all chemists
const getAllChemists = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Chemist || !models.HeadOffice || !models.ChemistAnnualTurnover) {
      throw new Error('Required models are not available');
    }
    const { Chemist, HeadOffice, ChemistAnnualTurnover } = models;

    const chemists = await Chemist.findAll({
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: ChemistAnnualTurnover,
          as: 'AnnualTurnovers',
          attributes: ['year', 'amount']
        }
      ]
    });

    const transformedChemists = chemists.map(chemist => {
      const chemistObj = chemist.toJSON();
      return {
        ...chemistObj,
        annualTurnover: chemistObj.AnnualTurnovers ? chemistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: chemistObj.HeadOffice || chemistObj.headOffice,
        _id: chemistObj.id,
        createdAt: chemistObj.created_at,
        updatedAt: chemistObj.updated_at,
        geo_image_status: !!chemistObj.geo_image_url,
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };
    });

    res.json({
      success: true,
      count: transformedChemists.length,
      data: transformedChemists
    });
  } catch (error) {
    console.error('Get all chemists error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET chemist by ID
const getChemistById = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Chemist || !models.HeadOffice || !models.ChemistAnnualTurnover) {
      throw new Error('Required models are not available');
    }
    const { Chemist, HeadOffice, ChemistAnnualTurnover } = models;

    const chemist = await Chemist.findByPk(req.params.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: ChemistAnnualTurnover,
          as: 'AnnualTurnovers',
          attributes: ['year', 'amount']
        }
      ]
    });

    if (!chemist) {
      return res.status(404).json({
        success: false,
        message: 'Chemist not found'
      });
    }

    const chemistObj = chemist.toJSON();
    const transformedChemist = {
      ...chemistObj,
      annualTurnover: chemistObj.AnnualTurnovers ? chemistObj.AnnualTurnovers.map(turnover => ({
        year: turnover.year,
        amount: parseFloat(turnover.amount)
      })) : [],
      headOffice: chemistObj.HeadOffice || chemistObj.headOffice,
      _id: chemistObj.id,
      createdAt: chemistObj.created_at,
      updatedAt: chemistObj.updated_at,
      geo_image_status: !!chemistObj.geo_image_url,
      AnnualTurnovers: undefined,
      HeadOffice: undefined
    };

    res.json({
      success: true,
      data: transformedChemist
    });
  } catch (error) {
    console.error('Get chemist by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new chemist
const createChemist = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    if (!models || !models.Chemist || !models.HeadOffice || !models.ChemistAnnualTurnover || !sequelize) {
      throw new Error('Required models or Sequelize instance are not available');
    }
    const { Chemist, HeadOffice, ChemistAnnualTurnover } = models;

    // Log the incoming request body for debugging
    console.log('Incoming chemist data:', JSON.stringify(req.body, null, 2));

    // Process the incoming data
    const chemistData = { ...req.body };

    // Handle head office ID field conversion
    // The frontend might send headOfficeId, head_office_id, or headOffice
    if (chemistData.headOfficeId) {
      // Keep as is for Sequelize model - this is the correct field name
      console.log('Using headOfficeId as is:', chemistData.headOfficeId);
    } else if (chemistData.head_office_id) {
      // Convert database column name to model field name
      chemistData.headOfficeId = chemistData.head_office_id;
      delete chemistData.head_office_id;
      console.log('Converted head_office_id to headOfficeId:', chemistData.headOfficeId);
    } else if (chemistData.headOffice) {
      // Convert alternative field name to model field name
      chemistData.headOfficeId = chemistData.headOffice;
      delete chemistData.headOffice;
      console.log('Converted headOffice to headOfficeId:', chemistData.headOfficeId);
    }

    // Handle field name conversions from camelCase to snake_case
    const fieldMappings = {
      firmName: 'firm_name',
      contactPersonName: 'contact_person_name',
      mobileNo: 'mobile_no',
      emailId: 'email_id',
      drugLicenseNumber: 'drug_license_number',
      gstNo: 'gst_no',
      yearsInBusiness: 'years_in_business',
      headOfficeId: 'head_office_id'
    };

    // Convert field names and collect data for the main chemist record
    const chemistRecordData = {};
    Object.keys(chemistData).forEach(key => {
      // Skip annualTurnover as it will be handled separately
      if (key === 'annualTurnover') return;

      const dbFieldName = fieldMappings[key] || key;
      chemistRecordData[dbFieldName] = chemistData[key];
    });

    // Validate that headOfficeId is provided
    if (!chemistRecordData.head_office_id) {
      return res.status(400).json({
        success: false,
        message: 'Head Office ID is required'
      });
    }

    // Validate that firmName is provided
    if (!chemistRecordData.firm_name) {
      return res.status(400).json({
        success: false,
        message: 'Firm Name is required'
      });
    }

    // Handle geo_image upload if file is provided
    if (req.file) {
      console.log('Processing geo_image upload...');
      const cloudinary = require('../config/cloudinary');

      try {
        const result = await new Promise((resolve, reject) => {
          const upload_stream = cloudinary.uploader.upload_stream(
            {
              folder: 'chemist_geo_images',
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

        chemistRecordData.geo_image_url = result.secure_url;
        console.log('Geo-image uploaded to Cloudinary:', result.secure_url);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Continue with chemist creation even if image upload fails
      }
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      console.log('Creating chemist with data:', chemistRecordData);
      const chemist = await Chemist.create(chemistRecordData, { transaction });
      console.log('Chemist created successfully:', chemist.id);

      // Handle annual turnover data if provided
      if (chemistData.annualTurnover && Array.isArray(chemistData.annualTurnover) && chemistData.annualTurnover.length > 0) {
        // Create annual turnover records
        const annualTurnoverRecords = chemistData.annualTurnover.map(turnover => ({
          chemist_id: chemist.id,
          year: parseInt(turnover.year, 10),
          amount: parseFloat(turnover.amount)
        })).filter(turnover => !isNaN(turnover.year) && !isNaN(turnover.amount));

        if (annualTurnoverRecords.length > 0) {
          await ChemistAnnualTurnover.bulkCreate(annualTurnoverRecords, { transaction });
        }
      }

      // Fetch the created chemist with associations
      const createdChemist = await Chemist.findByPk(chemist.id, {
        include: [
          {
            model: HeadOffice,
            as: 'HeadOffice',
            attributes: ['id', 'name']
          },
          {
            model: ChemistAnnualTurnover,
            as: 'AnnualTurnovers',
            attributes: ['year', 'amount']
          }
        ],
        transaction
      });

      // Commit the transaction
      await transaction.commit();

      // Transform the response to match the MongoDB format
      const chemistObj = createdChemist.toJSON();
      const transformedChemist = {
        ...chemistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: chemistObj.AnnualTurnovers ? chemistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        annualTurnover: chemistObj.AnnualTurnovers ? chemistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: chemistObj.HeadOffice || chemistObj.headOffice,
        _id: chemistObj.id,
        createdAt: chemistObj.created_at,
        updatedAt: chemistObj.updated_at,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };

      res.status(201).json({
        success: true,
        data: transformedChemist
      });
    } catch (error) {
      // Rollback the transaction in case of error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Create chemist error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a chemist
const updateChemist = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    if (!models || !models.Chemist || !models.HeadOffice || !models.ChemistAnnualTurnover || !sequelize) {
      throw new Error('Required models or Sequelize instance are not available');
    }
    const { Chemist, HeadOffice, ChemistAnnualTurnover } = models;

    const chemist = await Chemist.findByPk(req.params.id);
    if (!chemist) {
      return res.status(404).json({
        success: false,
        message: 'Chemist not found'
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
              folder: 'chemist_geo_images',
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
        // Continue with chemist update even if image upload fails
      }
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Map headOffice to head_office_id if needed
      const chemistData = { ...req.body };
      if (chemistData.headOffice && !chemistData.head_office_id) {
        chemistData.head_office_id = chemistData.headOffice;
        delete chemistData.headOffice;
      }

      // Handle field name conversions from camelCase to snake_case
      const fieldMappings = {
        firmName: 'firm_name',
        contactPersonName: 'contact_person_name',
        mobileNo: 'mobile_no',
        emailId: 'email_id',
        drugLicenseNumber: 'drug_license_number',
        gstNo: 'gst_no',
        yearsInBusiness: 'years_in_business',
        headOfficeId: 'head_office_id'
      };

      // Convert field names and collect data for the main chemist record
      const chemistUpdateData = {};
      Object.keys(chemistData).forEach(key => {
        // Skip annualTurnover as it will be handled separately
        if (key === 'annualTurnover') return;

        const dbFieldName = fieldMappings[key] || key;
        chemistUpdateData[dbFieldName] = chemistData[key];
      });

      // Add uploaded image URL if available
      if (uploadedImageUrl) {
        chemistUpdateData.geo_image_url = uploadedImageUrl;
      }

      await chemist.update(chemistUpdateData, { transaction });

      // Handle annual turnover data if provided
      if ('annualTurnover' in chemistData) {
        // Delete existing annual turnover records
        await ChemistAnnualTurnover.destroy({
          where: { chemist_id: chemist.id },
          transaction
        });

        // Create new annual turnover records if provided
        if (chemistData.annualTurnover && Array.isArray(chemistData.annualTurnover) && chemistData.annualTurnover.length > 0) {
          const annualTurnoverRecords = chemistData.annualTurnover.map(turnover => ({
            chemist_id: chemist.id,
            year: parseInt(turnover.year, 10),
            amount: parseFloat(turnover.amount)
          })).filter(turnover => !isNaN(turnover.year) && !isNaN(turnover.amount));

          if (annualTurnoverRecords.length > 0) {
            await ChemistAnnualTurnover.bulkCreate(annualTurnoverRecords, { transaction });
          }
        }
      }

      // Fetch the updated chemist with associations
      const updatedChemist = await Chemist.findByPk(chemist.id, {
        include: [
          {
            model: HeadOffice,
            as: 'HeadOffice',
            attributes: ['id', 'name']
          },
          {
            model: ChemistAnnualTurnover,
            as: 'AnnualTurnovers',
            attributes: ['year', 'amount']
          }
        ],
        transaction
      });

      // Commit the transaction
      await transaction.commit();

      // Transform the response to match the MongoDB format
      const chemistObj = updatedChemist.toJSON();
      const transformedChemist = {
        ...chemistObj,
        // Convert annual_turnover to the format expected by the frontend
        annual_turnover: chemistObj.AnnualTurnovers ? chemistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        annualTurnover: chemistObj.AnnualTurnovers ? chemistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: chemistObj.HeadOffice || chemistObj.headOffice,
        _id: chemistObj.id,
        createdAt: chemistObj.created_at,
        updatedAt: chemistObj.updated_at,
        // Remove the nested objects
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };

      res.json({
        success: true,
        data: transformedChemist
      });
    } catch (error) {
      // Rollback the transaction in case of error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Update chemist error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a chemist
const deleteChemist = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Chemist) {
      throw new Error('Required models are not available');
    }
    const { Chemist } = models;

    const chemist = await Chemist.findByPk(req.params.id);
    if (!chemist) {
      return res.status(404).json({
        success: false,
        message: 'Chemist not found'
      });
    }

    await chemist.destroy();
    res.json({
      success: true,
      message: 'Chemist deleted successfully'
    });
  } catch (error) {
    console.error('Delete chemist error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET chemists by head office ID
const getChemistsByHeadOffice = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Chemist) {
      throw new Error('Required models are not available');
    }
    const { Chemist } = models;

    const { headOfficeId } = req.params;
    const chemists = await Chemist.findAll({
      where: {
        head_office_id: headOfficeId
      }
    });
    res.json(chemists);
  } catch (error) {
    console.error('Get chemists by head office error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET chemists for current user's head offices
const getMyChemists = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Chemist || !models.HeadOffice || !models.User || !models.ChemistAnnualTurnover) {
      throw new Error('Required models are not available');
    }
    const { Chemist, HeadOffice, User, ChemistAnnualTurnover } = models;

    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] }
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

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

    const chemists = await Chemist.findAll({
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
          model: ChemistAnnualTurnover,
          as: 'AnnualTurnovers',
          attributes: ['year', 'amount']
        }
      ]
    });

    const transformedChemists = chemists.map(chemist => {
      const chemistObj = chemist.toJSON();
      return {
        ...chemistObj,
        annualTurnover: chemistObj.AnnualTurnovers ? chemistObj.AnnualTurnovers.map(turnover => ({
          year: turnover.year,
          amount: parseFloat(turnover.amount)
        })) : [],
        headOffice: chemistObj.HeadOffice || chemistObj.headOffice,
        _id: chemistObj.id,
        createdAt: chemistObj.created_at,
        updatedAt: chemistObj.updated_at,
        geo_image_status: !!chemistObj.geo_image_url,
        AnnualTurnovers: undefined,
        HeadOffice: undefined
      };
    });

    res.json({
      success: true,
      count: transformedChemists.length,
      data: transformedChemists
    });
  } catch (error) {
    console.error('Get my chemists error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Bulk create chemists
const createBulkChemists = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Chemist || !models.HeadOffice) {
      throw new Error('Required models are not available');
    }
    const { Chemist, HeadOffice } = models;

    // Validate request body
    if (!req.body.chemists || !Array.isArray(req.body.chemists)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must contain a "chemists" array'
      });
    }

    const chemistsData = req.body.chemists;
    if (chemistsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Chemists array cannot be empty'
      });
    }

    if (chemistsData.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create more than 100 chemists at once'
      });
    }

    console.log(`Creating ${chemistsData.length} chemists in bulk...`);

    // Process and validate each chemist data
    const processedChemists = [];
    const errors = [];

    for (let i = 0; i < chemistsData.length; i++) {
      const chemistData = { ...chemistsData[i] };
      try {
        // Handle head office ID field conversion
        if (chemistData.headOfficeId) {
          chemistData.head_office_id = chemistData.headOfficeId;
          delete chemistData.headOfficeId;
        } else if (chemistData.head_office_id) {
          // Keep as is
        } else if (chemistData.headOffice) {
          chemistData.head_office_id = chemistData.headOffice;
          delete chemistData.headOffice;
        }

        // Validate required fields
        if (!chemistData.name) {
          errors.push(`Chemist ${i + 1}: Name is required`);
          continue;
        }
        if (!chemistData.head_office_id) {
          errors.push(`Chemist ${i + 1}: Head Office ID is required`);
          continue;
        }

        // Add index for tracking
        chemistData._index = i + 1;
        processedChemists.push(chemistData);
      } catch (error) {
        errors.push(`Chemist ${i + 1}: ${error.message}`);
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found',
        errors: errors,
        validChemists: processedChemists.length,
        totalChemists: chemistsData.length
      });
    }

    // Create chemists in bulk using transaction
    const sequelize = req.app.get('sequelize');
    const transaction = await sequelize.transaction();

    try {
      // Remove _index before creating
      const cleanChemistsData = processedChemists.map(chemist => {
        const { _index, ...cleanData } = chemist;
        return cleanData;
      });

      // Bulk create chemists
      const createdChemists = await Chemist.bulkCreate(cleanChemistsData, {
        transaction,
        returning: true,
        validate: true
      });

      await transaction.commit();
      console.log(`Successfully created ${createdChemists.length} chemists`);

      // Fetch created chemists with associations
      const chemistIds = createdChemists.map(chemist => chemist.id);
      const chemistsWithAssociations = await Chemist.findAll({
        where: {
          id: { [require('sequelize').Op.in]: chemistIds }
        },
        include: [{
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        }]
      });

      // Transform the response
      const transformedChemists = chemistsWithAssociations.map(chemist => {
        const chemistObj = chemist.toJSON();
        return {
          ...chemistObj,
          headOffice: chemistObj.HeadOffice || chemistObj.headOffice,
          _id: chemistObj.id,
          createdAt: chemistObj.created_at,
          updatedAt: chemistObj.updated_at,
          HeadOffice: undefined
        };
      });

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdChemists.length} chemists`,
        count: createdChemists.length,
        data: transformedChemists
      });
    } catch (createError) {
      await transaction.rollback();
      console.error('Bulk create error:', createError);
      res.status(400).json({
        success: false,
        message: 'Failed to create chemists',
        error: createError.message
      });
    }
  } catch (error) {
    console.error('Bulk create chemists error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllChemists,
  getChemistById,
  createChemist,
  updateChemist,
  deleteChemist,
  getChemistsByHeadOffice,
  getMyChemists,
  createBulkChemists
};