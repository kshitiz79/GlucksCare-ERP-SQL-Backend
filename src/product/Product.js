const { DataTypes } = require('sequelize');

const Product = (sequelize) => {
  return sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    salt: {
      type: DataTypes.STRING(255)
    },
    description: {
      type: DataTypes.TEXT
    },
    dosage: {
      type: DataTypes.STRING(100)
    },
    image: {
      type: DataTypes.STRING(500)
    }
  }, {
    tableName: 'products',
    timestamps: true,
    underscored: true
  });
};

module.exports = Product;