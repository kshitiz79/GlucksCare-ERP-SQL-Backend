const { DataTypes } = require('sequelize');

const LocationHistory = (sequelize) => {
  return sequelize.define('LocationHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    polyline: {
      type: DataTypes.TEXT, // Mapbox/Google encoded polyline
      allowNull: false
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    distance: {
      type: DataTypes.FLOAT, // Meters
      defaultValue: 0
    },
    duration: {
      type: DataTypes.INTEGER, // Seconds
      defaultValue: 0
    },
    metadata: {
      type: DataTypes.JSONB, // e.g., { shift: "morning", area: "Terminal 1" }
      allowNull: true
    }
  }, {
    tableName: 'location_history',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'start_time'] } // For dashboard queries
    ]
  });
};

module.exports = LocationHistory;