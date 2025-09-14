// GET all users
const getAllUsers = async (req, res) => {
  try {
    // Get the User model from app context
    const { User, HeadOffice } = req.app.get('models');
    const users = await User.findAll({
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] } // Don't include junction table attributes
        }
      ]
    });
    
    // Transform users to match MongoDB format
    const transformedUsers = users.map(user => {
      // Convert snake_case to camelCase
      const transformedUser = {
        _id: user.id,
        id: user.id,
        employeeCode: user.employee_code,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobile_number,
        gender: user.gender,
        role: user.role,
        headOffice: user.head_office_id,
        state: user.state_id,
        salaryAmount: user.salary_amount,
        address: user.address,
        dateOfBirth: user.date_of_birth,
        dateOfJoining: user.date_of_joining,
        bankDetails: user.bank_details,
        legalDocuments: user.legal_documents,
        emergencyContact: user.emergency_contact,
        reference: user.reference,
        isActive: user.is_active,
        emailVerified: user.email_verified,
        otp: user.otp,
        otpExpire: user.otp_expire,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        branch: user.branch_id,
        department: user.department_id,
        employmentType: user.employment_type_id
      };
      
      // Add headOffices array if exists
      if (user.headOffices) {
        transformedUser.headOffices = user.headOffices.map(ho => ({
          id: ho.id,
          name: ho.name,
          stateId: ho.state_id,
          pincode: ho.pincode,
          isActive: ho.is_active,
          createdAt: ho.created_at,
          updatedAt: ho.updated_at
        }));
      }
      
      return transformedUser;
    });
    
    res.json({
      success: true,
      data: transformedUsers,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: transformedUsers.length,
        limit: transformedUsers.length,
        hasNext: false,
        hasPrev: false
      },
      filters: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET user by ID
const getUserById = async (req, res) => {
  try {
    // Get the User model from app context
    const { User, HeadOffice } = req.app.get('models');
    const user = await User.findByPk(req.params.id, {
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
    
    // Transform user to match MongoDB format
    const transformedUser = {
      _id: user.id,
      id: user.id,
      employeeCode: user.employee_code,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobile_number,
      gender: user.gender,
      role: user.role,
      headOffice: user.head_office_id,
      state: user.state_id,
      salaryAmount: user.salary_amount,
      address: user.address,
      dateOfBirth: user.date_of_birth,
      dateOfJoining: user.date_of_joining,
      bankDetails: user.bank_details,
      legalDocuments: user.legal_documents,
      emergencyContact: user.emergency_contact,
      reference: user.reference,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      otp: user.otp,
      otpExpire: user.otp_expire,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      branch: user.branch_id,
      department: user.department_id,
      employmentType: user.employment_type_id
    };
    
    // Add headOffices array if exists
    if (user.headOffices) {
      transformedUser.headOffices = user.headOffices.map(ho => ({
        id: ho.id,
        name: ho.name,
        stateId: ho.state_id,
        pincode: ho.pincode,
        isActive: ho.is_active,
        createdAt: ho.created_at,
        updatedAt: ho.updated_at
      }));
    }
    
    res.json({
      success: true,
      data: transformedUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new user
const createUser = async (req, res) => {
  try {
    // Get the User model from app context
    const { User } = req.app.get('models');
    
    // Convert camelCase to snake_case for PostgreSQL
    const userData = {};
    Object.keys(req.body).forEach(key => {
      // Skip relationship fields for now
      if (['headOffices', 'designation', 'branch', 'department', 'employmentType', 'state', 'headOffice'].includes(key)) return;
      
      const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      userData[snakeCaseKey] = req.body[key];
    });
    
    const user = await User.create(userData);
    
    // Transform user to match MongoDB format
    const transformedUser = {
      _id: user.id,
      id: user.id,
      employeeCode: user.employee_code,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobile_number,
      gender: user.gender,
      role: user.role,
      headOffice: user.head_office_id,
      state: user.state_id,
      salaryAmount: user.salary_amount,
      address: user.address,
      dateOfBirth: user.date_of_birth,
      dateOfJoining: user.date_of_joining,
      bankDetails: user.bank_details,
      legalDocuments: user.legal_documents,
      emergencyContact: user.emergency_contact,
      reference: user.reference,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      otp: user.otp,
      otpExpire: user.otp_expire,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      branch: user.branch_id,
      department: user.department_id,
      employmentType: user.employment_type_id
    };
    
    res.status(201).json({
      success: true,
      data: transformedUser
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a user
const updateUser = async (req, res) => {
  try {
    // Get the User model from app context
    const { User } = req.app.get('models');
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Convert camelCase to snake_case for PostgreSQL
    const updateData = {};
    Object.keys(req.body).forEach(key => {
      // Skip password field and relationship fields for this endpoint
      if (key === 'password' || ['headOffices', 'designation', 'branch', 'department', 'employmentType', 'state', 'headOffice'].includes(key)) return;
      
      const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      updateData[snakeCaseKey] = req.body[key];
    });
    
    await user.update(updateData);
    
    // Transform user to match MongoDB format
    const transformedUser = {
      _id: user.id,
      id: user.id,
      employeeCode: user.employee_code,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobile_number,
      gender: user.gender,
      role: user.role,
      headOffice: user.head_office_id,
      state: user.state_id,
      salaryAmount: user.salary_amount,
      address: user.address,
      dateOfBirth: user.date_of_birth,
      dateOfJoining: user.date_of_joining,
      bankDetails: user.bank_details,
      legalDocuments: user.legal_documents,
      emergencyContact: user.emergency_contact,
      reference: user.reference,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      otp: user.otp,
      otpExpire: user.otp_expire,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      branch: user.branch_id,
      department: user.department_id,
      employmentType: user.employment_type_id
    };
    
    res.json({
      success: true,
      data: transformedUser
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a user
const deleteUser = async (req, res) => {
  try {
    // Get the User model from app context
    const { User } = req.app.get('models');
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    await user.destroy();
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET current user's assigned head offices
const getMyHeadOffices = async (req, res) => {
  try {
    // Get the User and HeadOffice models from app context
    const { User, HeadOffice } = req.app.get('models');
    
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

    // Return all assigned head offices as an array
    let headOffices = [];
    
    if (user.headOffices && user.headOffices.length > 0) {
      headOffices = user.headOffices.map(ho => ({
        _id: ho.id,
        id: ho.id,
        name: ho.name,
        code: ho.code,
        stateId: ho.state_id,
        pincode: ho.pincode,
        isActive: ho.is_active,
        createdAt: ho.created_at,
        updatedAt: ho.updated_at
      }));
    } else if (user.head_office_id) {
      // If user has a single head office, fetch it
      const singleHeadOffice = await HeadOffice.findByPk(user.head_office_id);
      if (singleHeadOffice) {
        headOffices = [{
          _id: singleHeadOffice.id,
          id: singleHeadOffice.id,
          name: singleHeadOffice.name,
          code: singleHeadOffice.code,
          stateId: singleHeadOffice.state_id,
          pincode: singleHeadOffice.pincode,
          isActive: singleHeadOffice.is_active,
          createdAt: singleHeadOffice.created_at,
          updatedAt: singleHeadOffice.updated_at
        }];
      }
    }

    res.json({
      success: true,
      data: headOffices
    });
  } catch (error) {
    console.error('Get my head offices error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getMyHeadOffices
};