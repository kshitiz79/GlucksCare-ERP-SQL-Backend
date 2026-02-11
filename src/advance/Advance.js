// Advance Model using Sequelize ORM
const { DataTypes } = require('sequelize');

const Advance = (sequelize) => {
  return sequelize.define('Advance', {
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
    requested_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    approved_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'partially_approved'),
      defaultValue: 'pending'
    },
    request_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    approval_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    advance_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date when the advance was actually taken/disbursed'
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    repayment_status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
      defaultValue: 'pending'
    },
    repayment_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    repayment_end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    monthly_deduction: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    total_repaid: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    }
  }, {
    tableName: 'advances',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
};

module.exports = Advance;
