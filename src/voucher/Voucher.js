// src/voucher/Voucher.js
const { DataTypes } = require('sequelize');

const Voucher = (sequelize) => {
  return sequelize.define('Voucher', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    voucher_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Unique voucher number e.g. VCH-YYYYMMDD-XXXX'
    },
    voucher_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Date of the payment voucher'
    },
    voucher_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'receipt',
      comment: 'receipt (payment from party), advance_adjustment, etc.'
    },
    stockist_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stockists',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
      comment: 'Party / Stockist receiving payment from'
    },
    party_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Cached Stockist / Party firm name'
    },
    payment_mode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Cash',
      comment: 'Cash, Bank, Cheque, UPI, NEFT/RTGS, Advance_Adjustment, etc.'
    },
    bank_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'master_banks',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Bank account if payment_mode is Bank/Cheque/UPI'
    },
    reference_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Cheque No / UTR / Transaction reference'
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Total amount received / transacted in this voucher'
    },
    allocated_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Total amount allocated to invoice(s)'
    },
    advance_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Excess amount credited to party advance ledger'
    },
    used_advance_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Pre-existing advance balance consumed in this payment'
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'posted',
      comment: 'posted, cancelled'
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notes / remarks'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: 'User who created the voucher'
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      comment: 'User who updated the voucher'
    }
  }, {
    tableName: 'vouchers',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['voucher_number'], unique: true },
      { fields: ['voucher_date'] },
      { fields: ['stockist_id'] },
      { fields: ['bank_id'] },
      { fields: ['payment_mode'] },
      { fields: ['created_by'] }
    ]
  });
};

module.exports = Voucher;
