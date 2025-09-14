const { DataTypes } = require('sequelize');

const HeadOffice = (sequelize) => {
  return sequelize.define('HeadOffice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    stateId: {
      type: DataTypes.UUID,
      references: {
        model: 'states',
        key: 'id'
      }
    },
    pincode: {
      type: DataTypes.STRING(10)
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'head_offices',
    timestamps: true,
    underscored: true
  });
};

module.exports = HeadOffice;