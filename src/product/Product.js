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
    salt_id: {
      type: DataTypes.UUID
    },
    unit_id: {
      type: DataTypes.UUID
    },
    stripsize_id: {
      type: DataTypes.UUID
    },
    hsn_id: {
      type: DataTypes.UUID
    },
    gst_id: {
      type: DataTypes.UUID
    },
    packsize_id: {
      type: DataTypes.UUID
    },
    // kept for legacy temporarily
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