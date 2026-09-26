// src/voucher/StockistAdvanceTransaction.js
const { DataTypes } = require('sequelize');

const StockistAdvanceTransaction = (sequelize) => {
  return sequelize.define('StockistAdvanceTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stockist_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stockists',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      comment: 'Party / Stockist'
    },
    voucher_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'vouchers',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Originating voucher (if credit) or adjusting voucher (if debit)'
    },
    invoice_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'invoice_tracking',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Target invoice if advance was adjusted towards it'
    },
    transaction_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Date of advance transaction'
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'credit (advance received/increased) or debit (advance adjusted/used)'
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Transaction amount'
    },
    balance_after: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Running advance balance after this transaction'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Audit notes e.g. "Excess payment from VCH-001" or "Adjusted on INV-1002"'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    }
  }, {
    tableName: 'stockist_advance_transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['stockist_id'] },
      { fields: ['voucher_id'] },
      { fields: ['invoice_id'] },
      { fields: ['transaction_date'] }
    ]
  });
};

module.exports = StockistAdvanceTransaction;
