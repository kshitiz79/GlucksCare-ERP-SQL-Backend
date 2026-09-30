// src/voucher/VoucherPaymentAllocation.js
const { DataTypes } = require('sequelize');

const VoucherPaymentAllocation = (sequelize) => {
  return sequelize.define('VoucherPaymentAllocation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'vouchers',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      comment: 'Parent payment voucher ID'
    },
    invoice_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'invoice_tracking',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
      comment: 'Target invoice ID being paid (null if opening_balance)'
    },
    opening_balance_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'party_opening_balances',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
      comment: 'Target party opening balance ID being paid'
    },
    allocation_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'invoice',
      comment: 'invoice | opening_balance'
    },
    allocated_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Amount allocated from voucher to this specific invoice'
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'voucher_payment_allocations',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['voucher_id'] },
      { fields: ['invoice_id'] },
      { fields: ['opening_balance_id'] }
    ]
  });
};

module.exports = VoucherPaymentAllocation;
