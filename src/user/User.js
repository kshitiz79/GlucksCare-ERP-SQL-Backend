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
      type: DataTypes.ENUM('Male', 'Female'),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM(
        'Super Admin', 'Admin', 'Opps Team', 'National Head',
        'State Head', 'Zonal Manager', 'Area Manager', 'Manager', 'User'
      ),
      allowNull: false
    },
    head_office_id: {
      type: DataTypes.UUID,
      references: {
        model: 'head_offices',
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
    bank_details: {
      type: DataTypes.JSONB
    },
    legal_documents: {
      type: DataTypes.JSONB
    },
    emergency_contact: {
      type: DataTypes.JSONB
    },
    reference: {
      type: DataTypes.JSONB
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    otp: {
      type: DataTypes.STRING(10)
    },
    otp_expire: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true
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
  UserModel.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password_hash);
  };

  // Add comparePassword method for compatibility with existing frontend code
  UserModel.prototype.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password_hash);
  };
};

module.exports = { User, setupHooks };