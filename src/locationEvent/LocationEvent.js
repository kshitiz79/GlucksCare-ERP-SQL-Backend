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
      allowNull: false
    },
    raw_data: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    processing_result: {
      type: DataTypes.JSONB
    },
    processing_time: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'location_events',
    timestamps: true,
    underscored: true
  });
};

module.exports = LocationEvent;