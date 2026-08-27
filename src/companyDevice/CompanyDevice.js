// src/companyDevice/CompanyDevice.js
const { DataTypes } = require('sequelize');

const CompanyDevice = (sequelize) => {
  const model = sequelize.define('CompanyDevice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    company_device_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Internal company asset ID, e.g. GSC-TAB-0042'
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Samsung',
      comment: 'Device brand (e.g., Samsung)'
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Galaxy Tab A9+',
      comment: 'Device model (e.g., Galaxy Tab A9+, Tab A8)'
    },
    imei_1: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'Primary IMEI / Device Hardware Identifier'
    },
    imei_2: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Secondary IMEI (if dual SIM)'
    },
    serial_number: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Hardware serial number'
    },
    android_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Android ANDROID_ID'
    },
    android_version: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Android OS version (e.g. Android 14)'
    },
    app_version: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Gluckscare App Version (e.g. v2.4.1)'
    },
    mdm_enrollment_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Samsung Knox / MDM enrollment token or identifier'
    },
    current_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Currently assigned employee'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'IN_STOCK',
      comment: 'ACTIVE, IN_STOCK, IN_REPAIR, DAMAGED, RETIRED, LOST'
    },
    assigned_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date & time when current assignment started'
    },
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last time device synced telemetry/location'
    },
    last_latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    last_longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    last_address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    battery_pct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    is_charging: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    network_type: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '4G, 5G, WiFi, Offline'
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'company_devices',
    timestamps: true,
    underscored: true
  });

  return model;
};

module.exports = CompanyDevice;
