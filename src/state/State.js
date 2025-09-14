const { DataTypes } = require('sequelize');

const State = (sequelize) => {
  return sequelize.define('State', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    code: {
      type: DataTypes.STRING(3),
      allowNull: false,
      unique: true
    },
    country: {
      type: DataTypes.STRING(100),
      defaultValue: 'India'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'states',
    timestamps: true,
    underscored: true
  });
};

module.exports = State;