const { DataTypes } = require('sequelize');

const Doctor = (sequelize) => {
  return sequelize.define('Doctor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    specialization: {
      type: DataTypes.STRING(255)
    },
    clinic_name: {
      type: DataTypes.STRING(255)
    },
    clinic_address: {
      type: DataTypes.TEXT
    },
    location: {
      type: DataTypes.STRING(255)
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8)
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8)
    },
    email: {
      type: DataTypes.STRING(255)
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    registration_number: {
      type: DataTypes.STRING(100)
    },
    years_of_experience: {
      type: DataTypes.INTEGER
    },
    date_of_birth: {
      type: DataTypes.DATE
    },
    qualification: {
      type: DataTypes.STRING(255)
    },
    consultation_fee: {
      type: DataTypes.DECIMAL(10, 2)
    },
    available_timings: {
      type: DataTypes.STRING(255)
    },
    geo_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Cloudinary URL for chemist geo-tagged image'
    },
    gender: {
      type: DataTypes.STRING(10)
    },
    anniversary: {
      type: DataTypes.DATE
    },
    priority: {
      type: DataTypes.STRING(1),
      allowNull: false,
      defaultValue: 'C',
      validate: {
        isIn: {
          args: [['A', 'B', 'C']],
          msg: 'Priority must be A, B, or C'
        }
      }
    },
    headOfficeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'head_offices',
        key: 'id'
      }
    }
  }, {
    tableName: 'doctors',
    timestamps: true,
    underscored: true
  });
};

module.exports = Doctor;