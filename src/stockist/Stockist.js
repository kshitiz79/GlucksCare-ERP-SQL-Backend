const { DataTypes } = require('sequelize');

const Stockist = (sequelize) => {
  return sequelize.define('Stockist', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    firm_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    registered_business_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    nature_of_business: {
      type: DataTypes.ENUM('Proprietorship', 'Partnership', 'Private Ltd.', 'Public Ltd.'),
      allowNull: false
    },
    gst_number: {
      type: DataTypes.STRING(100)
    },
    drug_license_number: {
      type: DataTypes.STRING(100)
    },
    pan_number: {
      type: DataTypes.STRING(100)
    },
    registered_office_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8)
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8)
    },
    contact_person: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    designation: {
      type: DataTypes.STRING(255)
    },
    mobile_number: {
      type: DataTypes.STRING(20)
    },
    email_address: {
      type: DataTypes.STRING(255)
    },
    website: {
      type: DataTypes.STRING(255)
    },
    years_in_business: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    areas_of_operation: {
      type: DataTypes.ARRAY(DataTypes.STRING)
    },
    current_pharma_distributorships: {
      type: DataTypes.ARRAY(DataTypes.STRING)
    },
    warehouse_facility: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    storage_facility_size: {
      type: DataTypes.DECIMAL(10, 2)
    },
    cold_storage_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    number_of_sales_representatives: {
      type: DataTypes.INTEGER
    },
    bank_details: {
      type: DataTypes.JSONB
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
    tableName: 'stockists',
    timestamps: true,
    underscored: true
  });
};

module.exports = Stockist;