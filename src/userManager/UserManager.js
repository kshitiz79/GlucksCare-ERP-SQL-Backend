const { DataTypes } = require('sequelize');

const UserManager = (sequelize) => {
  const UserManagerModel = sequelize.define('UserManager', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    manager_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    manager_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'manager',
      validate: {
        isIn: [['manager', 'area_manager']]
      }
    }
  }, {
    tableName: 'user_managers',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'manager_id', 'manager_type']
      }
    ]
  });

  return UserManagerModel;
};

module.exports = UserManager;