const { DataTypes } = require('sequelize');

const ChemistVisit = (sequelize) => {
  const model = sequelize.define('ChemistVisit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    chemist_id: {
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
    tableName: 'chemist_visits',
    timestamps: true,
    underscored: true
  });
  
  // Define associations
  model.associate = (models) => {
    model.belongsTo(models.Chemist, {
      foreignKey: 'chemist_id',
      as: 'Chemist'
    });
    model.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
  };
  
  return model;
};

module.exports = ChemistVisit;