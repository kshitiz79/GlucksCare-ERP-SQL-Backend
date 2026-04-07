const { DataTypes } = require('sequelize');

const PartyExpense = (sequelize) => {
  const model = sequelize.define('PartyExpense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    party_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'doctor, chemist, or stockist'
    },
    party_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    party_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    expense_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Firm, Cash, or Gift'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'party_expenses',
    timestamps: true,
    underscored: true
  });

  return model;
};

module.exports = PartyExpense;
