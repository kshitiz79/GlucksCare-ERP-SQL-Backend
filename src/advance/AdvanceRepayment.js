// Advance Repayment Model using Sequelize ORM
const { DataTypes } = require('sequelize');

const AdvanceRepayment = (sequelize) => {
  return sequelize.define('AdvanceRepayment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    advance_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'advances',
        key: 'id'
      }
    },
    repayment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    payment_method: {
      type: DataTypes.ENUM('salary_deduction', 'cash', 'bank_transfer', 'other'),
      defaultValue: 'salary_deduction'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'advance_repayments',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false
  });
};

module.exports = AdvanceRepayment;
