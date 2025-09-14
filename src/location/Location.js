const { DataTypes } = require('sequelize');

const Location = (sequelize) => {
  return sequelize.define('Location', {
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
    user_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    device_id: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    accuracy: {
      type: DataTypes.DECIMAL(6, 2)
    },
    battery_level: {
      type: DataTypes.INTEGER
    },
    network_type: {
      type: DataTypes.STRING(20),
      defaultValue: 'unknown'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    country: {
      type: DataTypes.STRING(50)
    },
    is_suspicious: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'locations',
    timestamps: true,
    underscored: true
  });
};

module.exports = Location;