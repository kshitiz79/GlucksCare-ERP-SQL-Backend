const { DataTypes } = require('sequelize');

const NotificationRecipient = (sequelize) => {
  const NotificationRecipientModel = sequelize.define('NotificationRecipient', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    notification_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    read_at: {
      type: DataTypes.DATE
    },
    permanently_dismissed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'notification_recipients',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['notification_id', 'user_id']
      }
    ]
  });

  return NotificationRecipientModel;
};

module.exports = NotificationRecipient;