// src/userDevice/UserDevice.js

const { DataTypes } = require('sequelize');

const UserDevice = (sequelize) => {
  return sequelize.define('UserDevice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    device_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Legacy field - kept for backward compatibility'
    },
    // Device fingerprint components
    android_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Android ANDROID_ID - constant across app updates, changes on factory reset'
    },
    manufacturer: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Device manufacturer (e.g., Samsung, Xiaomi)'
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Device model (e.g., Galaxy Tab A8)'
    },
    device_fingerprint: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'SHA-256 hash of android_id + manufacturer + model'
    },
    device_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Human-readable device name'
    },
    device_type: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'android',
      comment: 'Device type: android, ios, web'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ACTIVE',
      validate: {
        isIn: [['ACTIVE', 'PENDING', 'REVOKED']]
      },
      comment: 'Device binding status'
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Admin tracking
    revoked_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Admin who revoked this device binding'
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    revoke_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'user_devices',
    timestamps: true,
    underscored: true
  });
};

module.exports = UserDevice;