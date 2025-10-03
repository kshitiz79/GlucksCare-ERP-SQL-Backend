const { DataTypes } = require('sequelize');

const StopEvents = (sequelize) => {
  return sequelize.define('StopEvents', {
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
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    stop_type: {
      type: DataTypes.ENUM('break', 'visit', 'meeting', 'lunch', 'other'),
      defaultValue: 'other'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'stop_events',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'start_time'] }
    ]
  });
};

module.exports = StopEvents;