const { DataTypes } = require('sequelize');

const Designation = (sequelize) => {
  return sequelize.define('Designation', {
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
    description: {
      type: DataTypes.TEXT
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'designations',
    timestamps: true,
    underscored: true
  });
};

module.exports = Designation;