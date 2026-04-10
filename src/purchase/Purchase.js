const { DataTypes } = require('sequelize');

const Purchase = (sequelize) => {
  return sequelize.define('Purchase', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    party_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the party (Doctor/Stockist/Chemist/User)'
    },
    party_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    party_type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Doctor, Stockist, Chemist, or User'
    },
    purchase_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    bill_number: {
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
        defaultValue: 'completed'
    }
  }, {
    tableName: 'purchases',
    timestamps: true,
    underscored: true
  });
};

module.exports = Purchase;
