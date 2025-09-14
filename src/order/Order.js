const { DataTypes } = require('sequelize');

const Order = (sequelize) => {
  return sequelize.define('Order', {
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
    user_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    doctor_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    product_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    note: {
      type: DataTypes.TEXT
    },
    date_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    underscored: true
  });
};

module.exports = Order;