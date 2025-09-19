const { DataTypes } = require('sequelize');

const UserHeadOffice = (sequelize) => {
  const UserHeadOfficeModel = sequelize.define('UserHeadOffice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    head_office_id: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    tableName: 'user_head_offices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // Table doesn't have updated_at column
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'head_office_id']
      }
    ]
  });

  return UserHeadOfficeModel;
};

module.exports = UserHeadOffice;