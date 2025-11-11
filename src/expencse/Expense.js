const { DataTypes } = require('sequelize');

const Expense = (sequelize) => {
  const model = sequelize.define('Expense', {
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
    user_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('travel', 'daily'),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    bill: {
      type: DataTypes.STRING(500)
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    date: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW
    },
    travel_details: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    rate_per_km: {
      type: DataTypes.DECIMAL(6, 2),
      defaultValue: 2.40
    },
    total_distance_km: {
      type: DataTypes.DECIMAL(8, 2),
      defaultValue: 0
    },
    daily_allowance_type: {
      type: DataTypes.ENUM('headoffice', 'outside')
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    edit_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    payment_status: {
      type: DataTypes.ENUM('unpaid', 'paid'),
      defaultValue: 'unpaid'
    },
    payment_date: {
      type: DataTypes.DATE
    },
    payment_month_year: {
      type: DataTypes.STRING(7)
    },
    transaction_id: {
      type: DataTypes.STRING(100)
    }
  }, {
    tableName: 'expenses',
    timestamps: true,
    underscored: true
  });

  // Define associations
  model.associate = (models) => {
    model.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'UserInfo'
    });
  };

  return model;
};

module.exports = Expense;