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
        headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
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
    
    // Map headOffice to head_office_id if needed
    const doctorData = { ...req.body };
    if (doctorData.headOffice && !doctorData.head_office_id) {
      doctorData.head_office_id = doctorData.headOffice;
      delete doctorData.headOffice;
    }
    
    // Handle camelCase to snake_case conversion
    const convertedData = {};
    Object.keys(doctorData).forEach(key => {
      const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      convertedData[snakeCaseKey] = doctorData[key];
    });
    
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

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorsByHeadOffice,
  getMyDoctors
};