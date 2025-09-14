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
      allowNull: false
    },
    coordinates: {
      type: DataTypes.JSONB,
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
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    duration: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    polyline: {
      type: DataTypes.TEXT
    },
    metadata: {
      type: DataTypes.JSONB
    }
  }, {
    tableName: 'location_history',
    timestamps: true,
    underscored: true
  });
};

module.exports = LocationHistory;