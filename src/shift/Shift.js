const { DataTypes } = require('sequelize');

const Shift = (sequelize) => {
  return sequelize.define('Shift', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    work_days: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false
    },
    break_duration: {
      type: DataTypes.INTEGER,
      defaultValue: 60
    },
    grace_period: {
      type: DataTypes.INTEGER,
      defaultValue: 15
    },
    minimum_hours: {
      type: DataTypes.DECIMAL(4, 2),
      defaultValue: 8.00
    },
    half_day_threshold: {
      type: DataTypes.DECIMAL(4, 2),
      defaultValue: 4.00
    },
    overtime_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    overtime_threshold: {
      type: DataTypes.DECIMAL(4, 2),
      defaultValue: 8.00
    },
    location_restricted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    allowed_locations: {
      type: DataTypes.JSONB
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'shifts',
    timestamps: true,
    underscored: true
  });
};

module.exports = Shift;