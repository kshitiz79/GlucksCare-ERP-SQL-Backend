const { DataTypes } = require('sequelize');

const UserInventory = (sequelize) => {
  return sequelize.define('UserInventory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    inventory_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'inventory_items',
        key: 'id'
      }
    },
    assigned_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'user_inventories',
    timestamps: true,
    underscored: true
  });
};

module.exports = UserInventory;
