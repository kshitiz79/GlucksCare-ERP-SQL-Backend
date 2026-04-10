const { DataTypes } = require('sequelize');

const PurchaseItem = (sequelize) => {
  return sequelize.define('PurchaseItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    purchase_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'purchases',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    product_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    rate: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    mrp: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'purchase_items',
    timestamps: true,
    underscored: true
  });
};

module.exports = PurchaseItem;
