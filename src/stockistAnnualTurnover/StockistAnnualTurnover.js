const { DataTypes } = require('sequelize');

const StockistAnnualTurnover = (sequelize) => {
  const StockistAnnualTurnoverModel = sequelize.define('StockistAnnualTurnover', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stockist_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    }
  }, {
    tableName: 'stockist_annual_turnover',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,  // Disable updated_at since it doesn't exist in the database
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['stockist_id', 'year']
      }
    ]
  });

  return StockistAnnualTurnoverModel;
};

module.exports = StockistAnnualTurnover;