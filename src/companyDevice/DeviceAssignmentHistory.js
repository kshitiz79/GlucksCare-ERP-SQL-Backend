// src/companyDevice/DeviceAssignmentHistory.js
const { DataTypes } = require('sequelize');

const DeviceAssignmentHistory = (sequelize) => {
  const model = sequelize.define('DeviceAssignmentHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    device_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'company_devices',
        key: 'id'
      },
      comment: 'Company device reference'
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Employee assigned to this device'
    },
    assigned_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'When assignment began'
    },
    unassigned_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When assignment ended (null if current)'
    },
    action_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ASSIGNED',
      comment: 'ASSIGNED, REPLACED, RETURNED, DAMAGED, REPAIRED, REVOKED'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Audit reason e.g. Initial Issue, Damaged screen, Employee transfer'
    },
    assigned_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Admin user who performed the action'
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this is the currently active assignment'
    }
  }, {
    tableName: 'device_assignment_histories',
    timestamps: true,
    underscored: true
  });

  return model;
};

module.exports = DeviceAssignmentHistory;
