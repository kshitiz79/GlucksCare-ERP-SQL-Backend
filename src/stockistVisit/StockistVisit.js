const { DataTypes } = require('sequelize');

const StockistVisit = (sequelize) => {
  const model = sequelize.define('StockistVisit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stockist_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8)
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8)
    }
  }, {
    tableName: 'stockist_visits',
    timestamps: true,
    underscored: true
  });
  
  // Define associations
  model.associate = (models) => {
    model.belongsTo(models.Stockist, {
      foreignKey: 'stockist_id',
      as: 'Stockist'
    });
    model.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
  };
  
  return model;
};

module.exports = StockistVisit;