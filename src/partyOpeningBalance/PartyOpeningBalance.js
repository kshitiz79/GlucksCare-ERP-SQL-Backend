// src/partyOpeningBalance/PartyOpeningBalance.js
const { DataTypes } = require('sequelize');

const PartyOpeningBalance = (sequelize) => {
  return sequelize.define('PartyOpeningBalance', {
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
      onUpdate: 'CASCADE'
    },
    financial_year_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'financial_years',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    direction: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'Dr',
      validate: {
        isIn: [['Dr', 'Cr']]
      }
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'MANUAL',
      validate: {
        isIn: [['MANUAL', 'PREVIOUS_FY_CARRY_FORWARD']]
      }
    },
    source_financial_year_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'financial_years',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
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
      },
      onDelete: 'SET NULL'
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    }
  }, {
    tableName: 'party_opening_balances',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['stockist_id', 'financial_year_id']
      },
      {
        fields: ['financial_year_id']
      }
    ]
  });
};

module.exports = PartyOpeningBalance;
