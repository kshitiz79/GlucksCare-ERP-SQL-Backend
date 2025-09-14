const { DataTypes } = require('sequelize');

const Branch = (sequelize) => {
  return sequelize.define('Branch', {
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
    tableName: 'branches',
    timestamps: true,
    underscored: true
  });
};

module.exports = Branch;