// GET users by state
const getUsersByState = async (req, res) => {
  try {
    const { stateId } = req.params;
    
    // Validate stateId parameter
    if (!stateId) {
      return res.status(400).json({
        success: false,
        message: 'State ID parameter is required'
      });
    }
    
    // Get the User and HeadOffice models from app context
    const { User, HeadOffice, State } = req.app.get('models');
    
    // Find users directly assigned to this state or assigned to head offices in this state
    const users = await User.findAll({
      where: {
        state_id: stateId
      },
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] } // Don't include junction table attributes
        }
      ]
    });

    // Also find users assigned to head offices in this state
    const headOfficesInState = await HeadOffice.findAll({
      where: {
        stateId: stateId
      }
    });

    const headOfficeIds = headOfficesInState.map(ho => ho.id);

    // Find users assigned to these head offices through the many-to-many relationship
    if (headOfficeIds.length > 0) {
      const usersInHeadOffices = await User.findAll({
        include: [
          {
            model: HeadOffice,
            as: 'headOffices',
            through: { attributes: [] },
            where: {
              id: headOfficeIds
            }
          }
        ]
      });

      // Merge the two user lists, avoiding duplicates
      const allUsers = [...users];
      const existingUserIds = new Set(users.map(u => u.id));
      
      usersInHeadOffices.forEach(user => {
        if (!existingUserIds.has(user.id)) {
          allUsers.push(user);
        }
      });

      // Transform users to match MongoDB format
      const transformedUsers = allUsers.map(user => {
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
        filters: {
          stateId: stateId
        }
      });
    } else {
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
        filters: {
          stateId: stateId
        }
      });
    }
  } catch (error) {
    console.error('Error fetching users by state:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET users by role
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    
    // Validate role parameter
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role parameter is required'
      });
    }
    
    // Get the User model from app context
    const { User, HeadOffice } = req.app.get('models');
    
    // Find users with the specified role
    const users = await User.findAll({
      where: {
        role: role
      },
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
        state: user.state_id, // This should be the state ID
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

      // Add headOffices array if exists (many-to-many relationship)
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
      filters: {
        role: role
      }
    });
  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

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

    // Validate required fields
    if (!req.body.name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!req.body.email) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!req.body.employeeCode) return res.status(400).json({ success: false, message: 'Employee Code is required' });
    if (!req.body.role) return res.status(400).json({ success: false, message: 'Role is required' });
    if (!req.body.gender) return res.status(400).json({ success: false, message: 'Gender is required' });

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: req.body.email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Check if employee code already exists
    const existingEmployeeCode = await User.findOne({ where: { employee_code: req.body.employeeCode } });
    if (existingEmployeeCode) {
      return res.status(400).json({ success: false, message: 'Employee Code already exists' });
    }

    // Convert camelCase to snake_case for PostgreSQL
    const userData = {};
    Object.keys(req.body).forEach(key => {
      // Skip relationship fields for now
      if (['headOffices', 'designation', 'branch', 'department', 'employmentType', 'state'].includes(key)) return;

      const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

      // Handle password field specially
      if (key === 'password') {
        userData['password_hash'] = req.body[key]; // Will be hashed by model hook
      } else {
        userData[snakeCaseKey] = req.body[key];
      }
    });

    // Set default values for admin-created users
    userData.email_verified = true;
    userData.email_verified_at = new Date();
    userData.is_active = true;

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

// UPDATE user password
const updateUserPassword = async (req, res) => {
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

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Update password (will be hashed by model hook)
    await user.update({ password_hash: password });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a user
const deleteUser = async (req, res) => {
  try {
    // Get models from app context
    const models = req.app.get('models');
    const { User, Expense, Attendance, Location, DoctorVisit, Ticket } = models;
    const sequelize = req.app.get('sequelize');

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Step 1: Create or find "N/A" user for non-nullable foreign keys
    console.log('Step 1: Creating/finding N/A user...');

    let naUser;
    try {
      // Try to find existing N/A user
      naUser = await User.findOne({
        where: {
          email: 'na@system.internal',
          name: 'N/A'
        }
      });

      if (!naUser) {
        // Create N/A user
        naUser = await User.create({
          employee_code: 'NA-SYSTEM-001',
          name: 'N/A',
          email: 'na@system.internal',
          password_hash: 'na-system-user',
          mobile_number: '0000000000',
          gender: 'Male',
          role: 'User',
          is_active: false,
          email_verified: true,
          email_verified_at: new Date()
        });
        console.log('✅ Created N/A user:', naUser.id);
      } else {
        console.log('✅ Found existing N/A user:', naUser.id);
      }
    } catch (naError) {
      console.error('❌ Failed to create/find N/A user:', naError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to create N/A user for reference replacement'
      });
    }

    // Step 2: Clear ALL foreign key references (both nullable and non-nullable)
    console.log('Step 2: Clearing ALL foreign key references...');

    let clearedReferences = {};

    try {
      // Get ALL foreign key constraints (both nullable and non-nullable)
      const allConstraints = await sequelize.query(`
        SELECT DISTINCT
          tc.table_name,
          kcu.column_name,
          col.is_nullable
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.columns col
          ON col.table_name = tc.table_name 
          AND col.column_name = kcu.column_name
          AND col.table_schema = 'public'
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `, { type: sequelize.QueryTypes.SELECT });

      console.log(`Found ${allConstraints ? allConstraints.length : 0} total foreign key constraints`);

      // Process each constraint
      if (allConstraints && Array.isArray(allConstraints)) {
        for (const constraint of allConstraints) {
          try {
            // Check if there are any records to update
            const checkResults = await sequelize.query(`
              SELECT COUNT(*) as count FROM "${constraint.table_name}" WHERE "${constraint.column_name}" = :userId
            `, {
              replacements: { userId: req.params.id },
              type: sequelize.QueryTypes.SELECT
            });

            const checkResult = checkResults[0];
            if (checkResult && checkResult.count > 0) {
              // Decide what to set based on nullability
              const newValue = constraint.is_nullable === 'YES' ? null : naUser.id;
              const displayValue = constraint.is_nullable === 'YES' ? 'NULL' : 'N/A User';

              // Update the references
              await sequelize.query(`
                UPDATE "${constraint.table_name}" 
                SET "${constraint.column_name}" = :newValue 
                WHERE "${constraint.column_name}" = :userId
              `, {
                replacements: {
                  userId: req.params.id,
                  newValue: newValue
                },
                type: sequelize.QueryTypes.UPDATE
              });

              clearedReferences[`${constraint.table_name}.${constraint.column_name}`] = {
                count: parseInt(checkResult.count),
                setTo: displayValue
              };
              console.log(`✅ Updated ${checkResult.count} references in ${constraint.table_name}.${constraint.column_name} to ${displayValue}`);
            }
          } catch (err) {
            console.log(`❌ Failed to clear ${constraint.table_name}.${constraint.column_name}:`, err.message);
            // Continue with other updates
          }
        }
      }
    } catch (queryError) {
      console.log('❌ Failed to get all constraints:', queryError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to get foreign key constraints'
      });
    }

    // Now use a transaction for personal data deletion and user deletion
    console.log('Step 3: Deleting personal data and user...');
    const transaction = await sequelize.transaction();

    try {
      console.log(`Starting deletion process for user: ${req.params.id}`);

      // Get counts for reporting (outside transaction to avoid locks)
      const counts = {};
      try {
        counts.expenses = await Expense.count({ where: { user_id: req.params.id } });
        counts.attendance = await Attendance.count({ where: { user_id: req.params.id } });
        counts.locations = await Location.count({ where: { user_id: req.params.id } });
        counts.doctorVisits = await DoctorVisit.count({ where: { user_id: req.params.id } });
        counts.tickets = await Ticket.count({ where: { user_id: req.params.id } });
        counts.createdUsers = await User.count({ where: { created_by: req.params.id } });
        counts.updatedUsers = await User.count({ where: { updated_by: req.params.id } });
      } catch (countError) {
        console.log('Error getting counts, continuing with deletion:', countError.message);
      }

      // 1. Delete personal data tables (user's own records) - Use individual transactions
      const personalDataTables = [
        'expenses', 'attendance', 'locations', 'tickets', 'doctor_visits',
        'chemist_visits', 'stockist_visits', 'sales_activities', 'location_events',
        'location_history', 'notification_recipients', 'orders', 'sales_targets',
        'user_head_offices', 'user_managers', 'user_shifts', 'versions',
        'high_frequency_tracks', 'real_time_locations', 'stop_events'
      ];

      let deletedCounts = {};
      for (const tableName of personalDataTables) {
        try {
          // Check if table exists and has user_id column
          const [tableExists] = await sequelize.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = :tableName
            );
          `, {
            replacements: { tableName },
            type: sequelize.QueryTypes.SELECT,
            transaction
          });

          if (!tableExists.exists) {
            console.log(`Table ${tableName} does not exist, skipping`);
            continue;
          }

          // Check if user_id column exists
          const [columnExists] = await sequelize.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = :tableName 
              AND column_name = 'user_id'
            );
          `, {
            replacements: { tableName },
            type: sequelize.QueryTypes.SELECT,
            transaction
          });

          if (!columnExists.exists) {
            console.log(`Column user_id does not exist in ${tableName}, skipping`);
            continue;
          }

          // Count and delete records
          const [countResult] = await sequelize.query(`
            SELECT COUNT(*) as count FROM "${tableName}" WHERE "user_id" = :userId
          `, {
            replacements: { userId: req.params.id },
            type: sequelize.QueryTypes.SELECT,
            transaction
          });

          if (countResult.count > 0) {
            await sequelize.query(`
              DELETE FROM "${tableName}" WHERE "user_id" = :userId
            `, {
              replacements: { userId: req.params.id },
              type: sequelize.QueryTypes.DELETE,
              transaction
            });

            deletedCounts[tableName] = parseInt(countResult.count);
            console.log(`✅ Deleted ${countResult.count} records from ${tableName}`);
          }
        } catch (err) {
          console.log(`❌ Could not delete from ${tableName}:`, err.message);
          // Continue with other tables instead of failing
        }
      }

      // Handle special cases for tables with different user column names
      const specialCases = [
        { table: 'leaves', column: 'employee_id', name: 'leaves_as_employee' },
        { table: 'doctor_visit_history', column: 'sales_rep_id', name: 'doctor_visit_history' }
      ];

      for (const special of specialCases) {
        try {
          const [count] = await sequelize.query(`
            SELECT COUNT(*) as count FROM "${special.table}" WHERE "${special.column}" = :userId
          `, {
            replacements: { userId: req.params.id },
            type: sequelize.QueryTypes.SELECT,
            transaction
          });

          if (count.count > 0) {
            await sequelize.query(`
              DELETE FROM "${special.table}" WHERE "${special.column}" = :userId
            `, {
              replacements: { userId: req.params.id },
              type: sequelize.QueryTypes.DELETE,
              transaction
            });
            deletedCounts[special.name] = parseInt(count.count);
            console.log(`✅ Deleted ${count.count} records from ${special.table}.${special.column}`);
          }
        } catch (err) {
          console.log(`❌ Could not delete from ${special.table}.${special.column}:`, err.message);
        }
      }

      // 2. Delete the user
      console.log('Deleting user record...');
      await user.destroy({ transaction });
      console.log('✅ User deleted successfully');

      // Commit the transaction
      await transaction.commit();
      console.log('✅ Transaction committed successfully');

      res.json({
        success: true,
        message: 'User and all personal data deleted successfully. Audit trail fields set to N/A.',
        deletedRecords: {
          user: 1,
          personalData: deletedCounts,
          clearedAuditTrail: clearedReferences,
          summary: {
            totalPersonalRecords: Object.values(deletedCounts).reduce((sum, count) => sum + count, 0),
            totalAuditReferences: Object.values(clearedReferences).reduce((sum, count) => sum + count, 0)
          }
        }
      });
    } catch (error) {
      // Rollback the transaction on error
      console.error('❌ Transaction error, rolling back:', error.message);
      try {
        await transaction.rollback();
        console.log('✅ Transaction rolled back successfully');
      } catch (rollbackError) {
        console.error('❌ Error during rollback:', rollbackError.message);
      }

      // Check if it's a foreign key constraint error
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete user due to foreign key constraints.',
          details: error.message,
          constraint: error.fields || error.constraint,
          table: error.table
        });
      }

      // Check for transaction abort error
      if (error.message && error.message.includes('current transaction is aborted')) {
        return res.status(400).json({
          success: false,
          message: 'Database transaction was aborted. This usually means one of the SQL operations failed.',
          details: 'Please check the server logs for specific error details.',
          suggestion: 'Try the operation again or contact support if the issue persists.'
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete user'
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

// CHECK user dependencies before deletion
const checkUserDependencies = async (req, res) => {
  try {
    // Get models from app context
    const models = req.app.get('models');
    const { User, Expense, Attendance, Location, DoctorVisit, Ticket } = models;

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check all dependencies
    const dependencies = {};

    // Check main tables
    const expenseCount = await Expense.count({ where: { user_id: req.params.id } });
    if (expenseCount > 0) dependencies.expenses = expenseCount;

    const attendanceCount = await Attendance.count({ where: { user_id: req.params.id } });
    if (attendanceCount > 0) dependencies.attendance = attendanceCount;

    const locationCount = await Location.count({ where: { user_id: req.params.id } });
    if (locationCount > 0) dependencies.locations = locationCount;

    const doctorVisitCount = await DoctorVisit.count({ where: { user_id: req.params.id } });
    if (doctorVisitCount > 0) dependencies.doctorVisits = doctorVisitCount;

    const ticketCount = await Ticket.count({ where: { user_id: req.params.id } });
    if (ticketCount > 0) dependencies.tickets = ticketCount;

    // Check audit trail references
    const createdUsersCount = await User.count({ where: { created_by: req.params.id } });
    if (createdUsersCount > 0) dependencies.createdUsers = createdUsersCount;

    const updatedUsersCount = await User.count({ where: { updated_by: req.params.id } });
    if (updatedUsersCount > 0) dependencies.updatedUsers = updatedUsersCount;

    const approvedAttendanceCount = await Attendance.count({ where: { approved_by: req.params.id } });
    if (approvedAttendanceCount > 0) dependencies.approvedAttendance = approvedAttendanceCount;

    // Check other models dynamically
    const otherModels = [
      'ChemistVisit', 'StockistVisit', 'SalesActivity', 'LocationHistory',
      'LocationEvent', 'UserHeadOffice', 'UserManager', 'UserShift',
      'NotificationRecipient', 'Order', 'SalesTarget', 'Version'
    ];

    for (const modelName of otherModels) {
      if (models[modelName]) {
        try {
          const count = await models[modelName].count({ where: { user_id: req.params.id } });
          if (count > 0) {
            dependencies[modelName.toLowerCase()] = count;
          }
        } catch (err) {
          // Model doesn't have user_id field, skip
        }
      }
    }

    const canDelete = Object.keys(dependencies).length === 0;

    res.json({
      success: true,
      canDelete,
      dependencies,
      totalRecords: Object.values(dependencies).reduce((sum, count) => sum + count, 0),
      message: canDelete
        ? 'User can be safely deleted'
        : 'User has dependencies that will be automatically handled during deletion'
    });
  } catch (error) {
    console.error('Check user dependencies error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check user dependencies'
    });
  }
};

// GET foreign key constraints for users table
const getUserConstraints = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');

    // Query to get all foreign key constraints referencing users table
    const constraints = await sequelize.query(`
      SELECT DISTINCT
        tc.table_name,
        kcu.column_name,
        tc.constraint_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'users'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `, { type: sequelize.QueryTypes.SELECT });

    // Also check specific user references
    const userId = req.params.id || 'a9741e97-235e-4101-ab23-94988baf2d46';
    const userReferences = {};

    for (const constraint of constraints) {
      try {
        const [result] = await sequelize.query(`
          SELECT COUNT(*) as count FROM "${constraint.table_name}" 
          WHERE "${constraint.column_name}" = :userId
        `, {
          replacements: { userId },
          type: sequelize.QueryTypes.SELECT
        });

        if (result.count > 0) {
          userReferences[`${constraint.table_name}.${constraint.column_name}`] = parseInt(result.count);
        }
      } catch (err) {
        console.log(`Could not check ${constraint.table_name}.${constraint.column_name}`);
      }
    }

    res.json({
      success: true,
      constraints,
      userReferences,
      message: `Found ${constraints.length} foreign key constraints referencing users table`
    });
  } catch (error) {
    console.error('Get user constraints error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get user constraints'
    });
  }
};

// SOFT DELETE a user (recommended approach)
const softDeleteUser = async (req, res) => {
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

    // Instead of deleting, just deactivate the user
    await user.update({
      is_active: false,
      updated_by: req.user?.id || null // If you have current user context
    });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Soft delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to deactivate user'
    });
  }
};

// DELETE user with options (more control)
const deleteUserWithOptions = async (req, res) => {
  try {
    // Get models from app context
    const { User, Expense } = req.app.get('models');
    const sequelize = req.app.get('sequelize');

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get options from request body
    const {
      deleteExpenses = true,
      clearAuditTrail = true,
      replacementUserId = null
    } = req.body;

    // Use a transaction to handle all operations
    const transaction = await sequelize.transaction();

    try {
      // Get counts for reporting
      const expenseCount = await Expense.count({ where: { user_id: req.params.id } });
      const createdUsersCount = await User.count({ where: { created_by: req.params.id } });
      const updatedUsersCount = await User.count({ where: { updated_by: req.params.id } });

      let deletedRecords = {
        user: 1,
        expenses: 0,
        clearedCreatedByReferences: 0,
        clearedUpdatedByReferences: 0,
        reassignedToUser: replacementUserId
      };

      // Handle expenses
      if (deleteExpenses) {
        await Expense.destroy({
          where: { user_id: req.params.id },
          transaction
        });
        deletedRecords.expenses = expenseCount;
      } else if (replacementUserId) {
        // Reassign expenses to another user
        const replacementUser = await User.findByPk(replacementUserId);
        if (replacementUser) {
          await Expense.update(
            {
              user_id: replacementUserId,
              user_name: replacementUser.name
            },
            {
              where: { user_id: req.params.id },
              transaction
            }
          );
          deletedRecords.reassignedExpenses = expenseCount;
        }
      }

      // Handle audit trail
      if (clearAuditTrail) {
        // Clear created_by references
        await User.update(
          { created_by: replacementUserId || null },
          {
            where: { created_by: req.params.id },
            transaction
          }
        );
        deletedRecords.clearedCreatedByReferences = createdUsersCount;

        // Clear updated_by references
        await User.update(
          { updated_by: replacementUserId || null },
          {
            where: { updated_by: req.params.id },
            transaction
          }
        );
        deletedRecords.clearedUpdatedByReferences = updatedUsersCount;
      }

      // Delete the user
      await user.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();

      res.json({
        success: true,
        message: 'User deleted with specified options',
        deletedRecords
      });
    } catch (error) {
      // Rollback the transaction on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Delete user with options error:', error);

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete user due to foreign key constraints.',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete user'
    });
  }
};

// FORCE DELETE a user (use with caution) - kept for backward compatibility
const forceDeleteUser = async (req, res) => {
  // Just call deleteUser since it now handles everything
  return deleteUser(req, res);
};

// GET state information for State Head user
const getMyState = async (req, res) => {
  try {
    // Get the User and State models from app context
    const { User, State } = req.app.get('models');
    
    // Check if user is a State Head
    if (req.user.role !== 'State Head') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only State Head users can access this endpoint.'
      });
    }
    
    // Get the state assigned to this State Head user
    const stateHeadUser = await User.findByPk(req.user.id);
    if (!stateHeadUser || !stateHeadUser.state_id) {
      return res.status(400).json({
        success: false,
        message: 'State Head user does not have a state assigned.'
      });
    }
    
    // Find the state information
    const state = await State.findByPk(stateHeadUser.state_id);
    if (!state) {
      return res.status(404).json({
        success: false,
        message: 'Assigned state not found.'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: state.id,
        name: state.name,
        code: state.code,
        country: state.country,
        createdAt: state.created_at,
        updatedAt: state.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching state for State Head:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// REGISTER ADMIN (no auth required - for initial setup)
const registerAdmin = async (req, res) => {
  try {
    // Get the User model from app context
    const { User } = req.app.get('models');

    // Validate required fields
    if (!req.body.name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!req.body.email) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!req.body.password) return res.status(400).json({ success: false, message: 'Password is required' });
    if (!req.body.employeeCode) return res.status(400).json({ success: false, message: 'Employee Code is required' });

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: req.body.email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Check if employee code already exists
    const existingEmployeeCode = await User.findOne({ where: { employee_code: req.body.employeeCode } });
    if (existingEmployeeCode) {
      return res.status(400).json({ success: false, message: 'Employee Code already exists' });
    }

    // Convert camelCase to snake_case for PostgreSQL
    const userData = {};
    Object.keys(req.body).forEach(key => {
      // Skip relationship fields for now
      if (['headOffices', 'designation', 'branch', 'department', 'employmentType', 'state', 'headOffice'].includes(key)) return;

      const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

      // Handle password field specially
      if (key === 'password') {
        userData['password_hash'] = req.body[key]; // Will be hashed by model hook
      } else {
        userData[snakeCaseKey] = req.body[key];
      }
    });

    // Force admin role and set default values
    userData.role = 'Admin';
    userData.email_verified = true;
    userData.email_verified_at = new Date();
    userData.is_active = true;

    const user = await User.create(userData);

    // Transform user to match MongoDB format (without sensitive data)
    const transformedUser = {
      _id: user.id,
      id: user.id,
      employeeCode: user.employee_code,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobile_number,
      gender: user.gender,
      role: user.role,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: transformedUser
    });
  } catch (error) {
    console.error('Register admin error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// REGISTER USER (no auth required - for creating regular users)
const registerUser = async (req, res) => {
  try {
    // Get the User model from app context
    const { User } = req.app.get('models');

    // Validate required fields
    if (!req.body.name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!req.body.email) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!req.body.password) return res.status(400).json({ success: false, message: 'Password is required' });
    if (!req.body.employeeCode) return res.status(400).json({ success: false, message: 'Employee Code is required' });

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: req.body.email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Check if employee code already exists
    const existingEmployeeCode = await User.findOne({ where: { employee_code: req.body.employeeCode } });
    if (existingEmployeeCode) {
      return res.status(400).json({ success: false, message: 'Employee Code already exists' });
    }

    // Convert camelCase to snake_case for PostgreSQL
    const userData = {};
    Object.keys(req.body).forEach(key => {
      // Skip relationship fields for now
      if (['headOffices', 'designation', 'branch', 'department', 'employmentType', 'state', 'headOffice'].includes(key)) return;

      const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

      // Handle password field specially
      if (key === 'password') {
        userData['password_hash'] = req.body[key]; // Will be hashed by model hook
      } else {
        userData[snakeCaseKey] = req.body[key];
      }
    });

    // Set role from request or default to 'User'
    userData.role = req.body.role || 'User';
    userData.email_verified = true;
    userData.email_verified_at = new Date();
    userData.is_active = true;

    const user = await User.create(userData);

    // Transform user to match MongoDB format (without sensitive data)
    const transformedUser = {
      _id: user.id,
      id: user.id,
      employeeCode: user.employee_code,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobile_number,
      gender: user.gender,
      role: user.role,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: transformedUser
    });
  } catch (error) {
    console.error('Register user error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUsersByRole,
  getUserById,
  createUser,
  updateUser,
  updateUserPassword,
  checkUserDependencies,
  getUserConstraints,
  softDeleteUser,
  deleteUserWithOptions,
  forceDeleteUser,
  getMyHeadOffices,
  registerAdmin,
  registerUser,
  getUsersByState,
  getMyState
};