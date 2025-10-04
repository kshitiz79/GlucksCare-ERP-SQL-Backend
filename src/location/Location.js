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
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    device_id: {
      type: DataTypes.STRING,
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
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    accuracy: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    battery_level: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    network_type: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'locations',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'timestamp'] }
    ]
  });
};

module.exports = Location;