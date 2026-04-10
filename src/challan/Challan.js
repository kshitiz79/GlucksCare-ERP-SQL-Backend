const { DataTypes } = require('sequelize');

const Challan = (sequelize) => {
  return sequelize.define('Challan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    party_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    party_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    party_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    challan_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    challan_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending' // pending, invoiced, cancelled
    }
  }, {
    tableName: 'challans',
    timestamps: true,
    underscored: true
  });
};

module.exports = Challan;
