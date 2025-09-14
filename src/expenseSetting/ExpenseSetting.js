const { DataTypes } = require('sequelize');

const ExpenseSetting = (sequelize) => {
  return sequelize.define('ExpenseSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    rate_per_km: {
      type: DataTypes.DECIMAL(6, 2),
      defaultValue: 2.40,
      validate: {
        min: 0
      }
    },
    head_office_amount: {
      type: DataTypes.DECIMAL(8, 2),
      defaultValue: 150.00,
      validate: {
        min: 0
      }
    },
    outside_head_office_amount: {
      type: DataTypes.DECIMAL(8, 2),
      defaultValue: 175.00,
      validate: {
        min: 0
      }
    }
  }, {
    tableName: 'expense_settings',
    timestamps: true,
    underscored: true
  });
};

module.exports = ExpenseSetting;