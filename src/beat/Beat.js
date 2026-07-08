const { DataTypes } = require('sequelize');

const Beat = (sequelize) => {
  return sequelize.define('Beat', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: '#4F46E5'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'beats',
    timestamps: true,
    underscored: true
  });
};

module.exports = Beat;
