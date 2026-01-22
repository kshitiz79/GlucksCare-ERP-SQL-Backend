const { DataTypes } = require('sequelize');

const Chemist = (sequelize) => {
  return sequelize.define('Chemist', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    firm_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    contact_person_name: {
      type: DataTypes.STRING(255)
    },
    designation: {
      type: DataTypes.STRING(255)
    },
    mobile_no: {
      type: DataTypes.STRING(20)
    },
    email_id: {
      type: DataTypes.STRING(255),
      unique: true
    },
    drug_license_number: {
      type: DataTypes.STRING(100),

    },
    gst_no: {
      type: DataTypes.STRING(20)
    },
    address: {
      type: DataTypes.TEXT
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8)
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8)
    },
    years_in_business: {
      type: DataTypes.INTEGER
    },
    geo_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Cloudinary URL for chemist geo-tagged image'
    },
    head_office_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'head_offices',
        key: 'id'
      }
    }
  }, {
    tableName: 'chemists',
    timestamps: true,
    underscored: true
  });
};

module.exports = Chemist;