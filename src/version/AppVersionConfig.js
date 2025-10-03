const { DataTypes } = require('sequelize');

const AppVersionConfig = (sequelize) => {
  return sequelize.define('AppVersionConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    latest_version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '1.0.0',
      validate: {
        is: /^\d+\.\d+\.\d+$/
      }
    },
    release_notes: {
      type: DataTypes.TEXT
    },
    force_update: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    minimum_required_version: {
      type: DataTypes.STRING(20),
      validate: {
        is: /^\d+\.\d+\.\d+$/
      },
      allowNull: true
    },
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
    tableName: 'app_version_configs',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
};

module.exports = AppVersionConfig;