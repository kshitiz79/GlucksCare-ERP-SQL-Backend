const { DataTypes } = require('sequelize');

const Sale = (sequelize) => {
  const model = sequelize.define('Sale', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    doctor_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'doctors',
        key: 'id'
      }
    },
    chemist_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'chemists',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'sales',
    timestamps: true,
    underscored: true
  });

  return model;
};

module.exports = Sale;
