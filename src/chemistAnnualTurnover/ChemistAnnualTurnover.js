const { DataTypes } = require('sequelize');

const ChemistAnnualTurnover = (sequelize) => {
  const ChemistAnnualTurnoverModel = sequelize.define('ChemistAnnualTurnover', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    chemist_id: {
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
    tableName: 'chemist_annual_turnover',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,  // Disable updated_at since it doesn't exist in the database
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['chemist_id', 'year']
      }
    ]
  });

  return ChemistAnnualTurnoverModel;
};

module.exports = ChemistAnnualTurnover;