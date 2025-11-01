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
      unique: true
    },
    device_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    device_type: {
      type: DataTypes.STRING,
      allowNull: true // 'android', 'ios', 'web'
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'user_devices',
    timestamps: true,
    underscored: true
  });
};

module.exports = UserDevice;