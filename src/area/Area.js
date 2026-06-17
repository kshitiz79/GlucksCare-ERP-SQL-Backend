const { DataTypes } = require('sequelize');

const Area = (sequelize) => {
  return sequelize.define('Area', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true
    },
    post_office: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    head_office_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'head_offices',
        key: 'id'
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'areas',
    timestamps: true,
    underscored: true
  });
};

module.exports = Area;
