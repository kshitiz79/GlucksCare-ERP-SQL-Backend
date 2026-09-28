// src/themeSetting/ThemeColor.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ThemeColor = sequelize.define('ThemeColor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    theme_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'FieldOmni'
    },
    color_key: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    color_hex: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    color_value_hex_int: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'brand'
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'theme_colors',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['theme_name', 'color_key']
      },
      {
        fields: ['category']
      },
      {
        fields: ['is_active']
      }
    ]
  });

  return ThemeColor;
};
