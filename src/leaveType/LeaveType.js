const { DataTypes } = require('sequelize');

const LeaveType = (sequelize) => {
  return sequelize.define('LeaveType', {
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
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT
    },
    max_days_per_year: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    max_consecutive_days: {
      type: DataTypes.INTEGER
    },
    carry_forward: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    carry_forward_limit: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    encashable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    requires_documents: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    document_types: {
      type: DataTypes.ARRAY(DataTypes.STRING)
    },
    applicable_for: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: ['All']
    },
    minimum_service_months: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    advance_application: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#3B82F6'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true, // Allow nu
      references: {
        model: 'users',
        key: 'id'
      }
    },
    updated_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'leave_types',
    timestamps: true,
    underscored: true
  });
};

module.exports = LeaveType;