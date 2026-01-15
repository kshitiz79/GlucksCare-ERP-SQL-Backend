// GET all doctors
const getAllDoctors = async (req, res) => {
  try {
    const { Doctor, HeadOffice } = req.app.get('models');
    const doctors = await Doctor.findAll({
      include: [{
        model: HeadOffice,
        as: 'HeadOffice',
        attributes: ['id', 'name'] // Only include necessary fields
      }],
      distinct: true // This prevents duplicates when using includes
    });

    // Transform the response to match the MongoDB format
    const transformedDoctors = doctors.map(doctor => {
      const doctorObj = doctor.toJSON();
      return {
        ...doctorObj,
        headOffice: doctorObj.HeadOffice || null,
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
        geo_image_status: !!doctorObj.geo_image_url // true if geo_image_url exists, false otherwise
        // Keep HeadOffice for frontend compatibility
      };
    });

    res.json({
      success: true,
      count: transformedDoctors.length,
      data: transformedDoctors
    });
  } catch (error) {
    console.error('Error in getAllDoctors:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET doctor by ID
const getDoctorById = async (req, res) => {
  try {
    const { Doctor, HeadOffice } = req.app.get('models');
    const doctor = await Doctor.findByPk(req.params.id, {
      include: [{
        model: HeadOffice,
        as: 'HeadOffice',
        attributes: ['id', 'name']
      }]
    });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Transform the response to match the MongoDB format
    const doctorObj = doctor.toJSON();
    const transformedDoctor = {
      ...doctorObj,
      headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
      _id: doctorObj.id,
      createdAt: doctorObj.created_at,
      updatedAt: doctorObj.updated_at,
      geo_image_status: !!doctorObj.geo_image_url,
      // Remove the nested objects
      HeadOffice: undefined
    };

    res.json({
      success: true,
      data: transformedDoctor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new doctor
const createDoctor = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Doctor || !models.HeadOffice) {
      throw new Error('Required models are not available');
    }
    const { Doctor, HeadOffice } = models;

    // Log the incoming request body for debugging
    console.log('Incoming doctor data:', JSON.stringify(req.body, null, 2));
    console.log('File uploaded:', req.file ? 'Yes' : 'No');

    // Process the incoming data
    const doctorData = { ...req.body };

    // Handle head office ID field conversion
    // The frontend might send headOfficeId, head_office_id, or headOffice
    if (doctorData.headOfficeId) {
      // Keep as is for Sequelize model - this is the correct field name
      console.log('Using headOfficeId as is:', doctorData.headOfficeId);
    } else if (doctorData.head_office_id) {
      // Convert database column name to model field name
      doctorData.headOfficeId = doctorData.head_office_id;
      delete doctorData.head_office_id;
      console.log('Converted head_office_id to headOfficeId:', doctorData.headOfficeId);
    } else if (doctorData.headOffice) {
      // Convert alternative field name to model field name
      doctorData.headOfficeId = doctorData.headOffice;
      delete doctorData.headOffice;
      console.log('Converted headOffice to headOfficeId:', doctorData.headOfficeId);
    }

    // Validate and set priority field
    if (doctorData.priority) {
      const priority = doctorData.priority.toUpperCase();
      if (!['A', 'B', 'C'].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Priority must be A, B, or C'
        });
      }
      doctorData.priority = priority;
    } else {
      // Default to 'C' if not provided
      doctorData.priority = 'C';
    }

    // Handle geo_image upload if file is provided
    if (req.file) {
      console.log('Processing geo_image upload...');
      const cloudinary = require('../config/cloudinary');

      try {
        const result = await new Promise((resolve, reject) => {
          const upload_stream = cloudinary.uploader.upload_stream(
            {
              folder: 'doctor_geo_images',
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

        doctorData.geo_image_url = result.secure_url;
        console.log('Geo-image uploaded to Cloudinary:', result.secure_url);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Continue with doctor creation even if image upload fails
        // You can choose to return error instead if image is mandatory
      }
    }

    // Log the processed data
    console.log('Processed doctor data:', JSON.stringify(doctorData, null, 2));

    // Validate that headOfficeId is provided
    if (!doctorData.headOfficeId) {
      return res.status(400).json({
        success: false,
        message: 'Head Office ID is required'
      });
    }

    console.log('Creating doctor with data:', doctorData);
    const doctor = await Doctor.create(doctorData);
    console.log('Doctor created successfully:', doctor.id);

    // Fetch the created doctor with associations
    const createdDoctor = await Doctor.findByPk(doctor.id, {
      include: [{
        model: HeadOffice,
        as: 'HeadOffice',
        attributes: ['id', 'name']
      }]
    });

    // Transform the response to match the MongoDB format
    const doctorObj = createdDoctor.toJSON();
    const transformedDoctor = {
      ...doctorObj,
      headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
      _id: doctorObj.id,
      createdAt: doctorObj.created_at,
      updatedAt: doctorObj.updated_at,
      // Remove the nested objects
      HeadOffice: undefined
    };

    res.status(201).json({
      success: true,
      data: transformedDoctor
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a doctor
const updateDoctor = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Doctor || !models.HeadOffice) {
      throw new Error('Required models are not available');
    }
    const { Doctor, HeadOffice } = models;

    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
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
              folder: 'doctor_geo_images',
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
        // Continue with doctor update even if image upload fails
      }
    }

    // Map headOffice to head_office_id if needed
    const doctorData = { ...req.body };
    if (doctorData.headOffice && !doctorData.head_office_id) {
      doctorData.head_office_id = doctorData.headOffice;
      delete doctorData.headOffice;
    }

    // Validate and set priority field if provided
    if (doctorData.priority) {
      const priority = doctorData.priority.toUpperCase();
      if (!['A', 'B', 'C'].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Priority must be A, B, or C'
        });
      }
      doctorData.priority = priority;
    }

    // Handle camelCase to snake_case conversion
    const convertedData = {};
    Object.keys(doctorData).forEach(key => {
      const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      convertedData[snakeCaseKey] = doctorData[key];
    });

    // Add uploaded image URL if available
    if (uploadedImageUrl) {
      convertedData.geo_image_url = uploadedImageUrl;
    }

    await doctor.update(convertedData);

    // Fetch the updated doctor with associations
    const updatedDoctor = await Doctor.findByPk(doctor.id, {
      include: [{
        model: HeadOffice,
        as: 'HeadOffice',
        attributes: ['id', 'name']
      }]
    });

    // Transform the response to match the MongoDB format
    const doctorObj = updatedDoctor.toJSON();
    const transformedDoctor = {
      ...doctorObj,
      headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
      _id: doctorObj.id,
      createdAt: doctorObj.created_at,
      updatedAt: doctorObj.updated_at,
      // Remove the nested objects
      HeadOffice: undefined
    };

    res.json({
      success: true,
      data: transformedDoctor
    });
  } catch (error) {
    console.error('Update doctor error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a doctor
const deleteDoctor = async (req, res) => {
  try {
    const { Doctor } = req.app.get('models');
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    await doctor.destroy();
    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET doctors by head office ID
const getDoctorsByHeadOffice = async (req, res) => {
  try {
    const { Doctor, HeadOffice } = req.app.get('models');
    const { headOfficeId } = req.params;
    const doctors = await Doctor.findAll({
      where: {
        headOfficeId: headOfficeId
      },
      include: [{
        model: HeadOffice,
        as: 'HeadOffice',
        attributes: ['id', 'name']
      }],
      distinct: true // This prevents duplicates when using includes
    });

    // Transform the response to match the MongoDB format
    const transformedDoctors = doctors.map(doctor => {
      const doctorObj = doctor.toJSON();
      return {
        ...doctorObj,
        headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
        geo_image_status: !!doctorObj.geo_image_url,
        // Remove the nested objects
        HeadOffice: undefined
      };
    });

    res.json({
      success: true,
      count: transformedDoctors.length,
      data: transformedDoctors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET doctors for current user's head offices
const getMyDoctors = async (req, res) => {
  try {
    const { Doctor, HeadOffice, User } = req.app.get('models');

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

    // Find all doctors assigned to user's head offices
    const doctors = await Doctor.findAll({
      where: {
        headOfficeId: { [require('sequelize').Op.in]: headOfficeIds }
      },
      include: [{
        model: HeadOffice,
        as: 'HeadOffice',
        attributes: ['id', 'name']
      }],
      distinct: true // This prevents duplicates when using includes
    });

    // Transform the response to match the MongoDB format
    const transformedDoctors = doctors.map(doctor => {
      const doctorObj = doctor.toJSON();
      return {
        ...doctorObj,
        headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
        geo_image_status: !!doctorObj.geo_image_url,
        // Remove the nested objects
        HeadOffice: undefined
      };
    });

    res.json(transformedDoctors);
  } catch (error) {
    console.error('Get my doctors error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// CREATE multiple doctors at once (Bulk Creation)
const createBulkDoctors = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Doctor || !models.HeadOffice) {
      throw new Error('Required models are not available');
    }
    const { Doctor, HeadOffice } = models;

    // Validate request body
    if (!req.body.doctors || !Array.isArray(req.body.doctors)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must contain a "doctors" array'
      });
    }

    const doctorsData = req.body.doctors;

    if (doctorsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Doctors array cannot be empty'
      });
    }

    if (doctorsData.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create more than 100 doctors at once'
      });
    }

    console.log(`Creating ${doctorsData.length} doctors in bulk...`);

    // Process and validate each doctor data
    const processedDoctors = [];
    const errors = [];

    for (let i = 0; i < doctorsData.length; i++) {
      const doctorData = { ...doctorsData[i] };

      try {
        // Handle head office ID field conversion
        if (doctorData.headOfficeId) {
          // Keep as is
        } else if (doctorData.head_office_id) {
          doctorData.headOfficeId = doctorData.head_office_id;
          delete doctorData.head_office_id;
        } else if (doctorData.headOffice) {
          doctorData.headOfficeId = doctorData.headOffice;
          delete doctorData.headOffice;
        }

        // Validate and set priority field
        if (doctorData.priority) {
          const priority = doctorData.priority.toUpperCase();
          if (!['A', 'B', 'C'].includes(priority)) {
            errors.push(`Doctor ${i + 1}: Priority must be A, B, or C`);
            continue;
          }
          doctorData.priority = priority;
        } else {
          // Default to 'C' if not provided
          doctorData.priority = 'C';
        }

        // Validate required fields
        if (!doctorData.name) {
          errors.push(`Doctor ${i + 1}: Name is required`);
          continue;
        }

        if (!doctorData.headOfficeId) {
          errors.push(`Doctor ${i + 1}: Head Office ID is required`);
          continue;
        }

        // Add index for tracking
        doctorData._index = i + 1;
        processedDoctors.push(doctorData);

      } catch (error) {
        errors.push(`Doctor ${i + 1}: ${error.message}`);
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found',
        errors: errors,
        validDoctors: processedDoctors.length,
        totalDoctors: doctorsData.length
      });
    }

    // Create doctors in bulk using transaction
    const sequelize = req.app.get('sequelize');
    const transaction = await sequelize.transaction();

    try {
      // Remove _index before creating
      const cleanDoctorsData = processedDoctors.map(doctor => {
        const { _index, ...cleanData } = doctor;
        return cleanData;
      });

      // Bulk create doctors
      const createdDoctors = await Doctor.bulkCreate(cleanDoctorsData, {
        transaction,
        returning: true, // Return created records
        validate: true   // Validate each record
      });

      await transaction.commit();

      console.log(`Successfully created ${createdDoctors.length} doctors`);

      // Fetch created doctors with associations
      const doctorIds = createdDoctors.map(doctor => doctor.id);
      const doctorsWithAssociations = await Doctor.findAll({
        where: {
          id: { [require('sequelize').Op.in]: doctorIds }
        },
        include: [{
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        }]
      });

      // Transform the response to match the MongoDB format
      const transformedDoctors = doctorsWithAssociations.map(doctor => {
        const doctorObj = doctor.toJSON();
        return {
          ...doctorObj,
          headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
          _id: doctorObj.id,
          createdAt: doctorObj.created_at,
          updatedAt: doctorObj.updated_at,
          // Remove the nested objects
          HeadOffice: undefined
        };
      });

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdDoctors.length} doctors`,
        count: createdDoctors.length,
        data: transformedDoctors
      });

    } catch (createError) {
      await transaction.rollback();
      console.error('Bulk create error:', createError);

      res.status(400).json({
        success: false,
        message: 'Failed to create doctors',
        error: createError.message
      });
    }

  } catch (error) {
    console.error('Bulk create doctors error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorsByHeadOffice,
  getMyDoctors,
  createBulkDoctors
};