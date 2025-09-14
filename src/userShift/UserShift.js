const { DataTypes } = require('sequelize');

const UserShift = (sequelize) => {
  const UserShiftModel = sequelize.define('UserShift', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    shift_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_shifts',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'shift_id']
      }
    ]
  });

  return UserShiftModel;
};

module.exports = UserShift;