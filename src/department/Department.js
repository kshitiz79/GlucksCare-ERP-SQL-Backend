const { DataTypes } = require('sequelize');

const Department = (sequelize) => {
  return sequelize.define('Department', {
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
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    created_by: {
      type: DataTypes.UUID
    },
    updated_by: {
      type: DataTypes.UUID
    }
  }, {
    tableName: 'departments',
    timestamps: true,
    underscored: true
  });
};

module.exports = Department;