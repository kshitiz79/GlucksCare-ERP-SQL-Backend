const { DataTypes } = require('sequelize');

const LocationEvent = (sequelize) => {
  return sequelize.define('LocationEvent', {
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
    event_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'location_events',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'timestamp'] },
      { fields: ['event_type'] }
    ]
  });
};

module.exports = LocationEvent;