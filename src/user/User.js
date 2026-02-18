const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// We'll define the model function to be called later
const User = (sequelize) => {
  return sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    employee_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    mobile_number: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    gender: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['Male', 'Female']]
      }
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['Super Admin', 'Admin', 'Opps Team', 'National Head', 'State Head', 'Zonal Manager', 'Area Manager', 'Manager', 'User', 'Accounts', 'Logistics']]
      }
    },
    // References
    head_office_id: {
      type: DataTypes.UUID,
      references: {
        model: 'head_offices',
        key: 'id'
      }
    },
    branch_id: {
      type: DataTypes.UUID,
      references: {
        model: 'branches',
        key: 'id'
      }
    },
    department_id: {
      type: DataTypes.UUID,
      references: {
        model: 'departments',
        key: 'id'
      }
    },
    designation_id: {
      type: DataTypes.UUID,
      references: {
        model: 'designations',
        key: 'id'
      }
    },
    employment_type_id: {
      type: DataTypes.UUID,
      references: {
        model: 'employment_types',
        key: 'id'
      }
    },
    state_id: {
      type: DataTypes.UUID,
      references: {
        model: 'states',
        key: 'id'
      }
    },
    // Employment Details
    salary_type: {
      type: DataTypes.STRING(20),
      defaultValue: 'Monthly',
      validate: {
        isIn: [['Monthly', 'Yearly']]
      }
    },
    salary_amount: {
      type: DataTypes.DECIMAL(12, 2)
    },
    address: {
      type: DataTypes.TEXT
    },
    date_of_birth: {
      type: DataTypes.DATE
    },
    date_of_joining: {
      type: DataTypes.DATE
    },
    // Bank Details (JSONB for flexibility)
    bank_details: {
      type: DataTypes.JSONB
    },
    // Legal Documents (JSONB for Cloudinary URLs)
    legal_documents: {
      type: DataTypes.JSONB
    },
    // Emergency Contact (JSONB)
    emergency_contact: {
      type: DataTypes.JSONB
    },
    // Reference (JSONB)
    reference: {
      type: DataTypes.JSONB
    },
    // Status and Verification
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    otp: {
      type: DataTypes.STRING(10)
    },
    otp_expire: {
      type: DataTypes.DATE
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    email_verified_at: {
      type: DataTypes.DATE
    },
    pin: {
      type: DataTypes.STRING(10)
    },
    pin_expire: {
      type: DataTypes.DATE
    },
    // FCM Token for push notifications
    fcm_token: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Firebase Cloud Messaging token for push notifications'
    },
    // Audit fields
    created_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    updated_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
};

// Hash password before saving
const setupHooks = (UserModel) => {
  UserModel.beforeCreate(async (user) => {
    if (user.password_hash) {
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(user.password_hash, salt);
    }
  });

  UserModel.beforeUpdate(async (user) => {
    if (user.changed('password_hash')) {
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(user.password_hash, salt);
    }
  });

  // Method to validate password
  UserModel.prototype.validatePassword = async function (password) {
    return await bcrypt.compare(password, this.password_hash);
  };

  // Add comparePassword method for compatibility with existing frontend code
  UserModel.prototype.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password_hash);
  };
};

module.exports = { User, setupHooks };