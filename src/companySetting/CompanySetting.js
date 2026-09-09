const { DataTypes } = require('sequelize');

const CompanySetting = (sequelize) => {
  return sequelize.define('CompanySetting', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    companyName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Gluckscare Pharmaceuticals',
      field: 'company_name'
    },
    logoUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '/login/logo.png',
      field: 'logo_url'
    },
    faviconUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'favicon_url'
    },
    tagline: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'tagline'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'updated_by'
    }
  }, {
    tableName: 'company_settings',
    timestamps: true,
    underscored: true
  });
};

module.exports = CompanySetting;
