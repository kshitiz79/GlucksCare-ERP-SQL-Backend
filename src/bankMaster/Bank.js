// src/bankMaster/Bank.js
const { DataTypes } = require('sequelize');

const Bank = (sequelize) => {
  return sequelize.define('Bank', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    bank_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    account_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    account_number: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    account_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'Current',
      allowNull: true
    },
    ifsc_code: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    branch_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    branch_code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    micr_code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    swift_code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    upi_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    upi_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    opening_balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: true
    },
    current_balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    pincode: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    contact_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    contact_person: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    net_banking_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'master_banks',
    timestamps: true,
    underscored: true
  });
};

module.exports = Bank;
