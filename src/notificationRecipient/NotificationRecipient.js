const { DataTypes } = require('sequelize');

const NotificationRecipient = (sequelize) => {
  const model = sequelize.define('NotificationRecipient', {
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
    createdAt: 'created_at',
    updatedAt: false, // Disable updatedAt since the table doesn't have this column
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['notification_id', 'user_id']
      }
    ]
  });

  // Define associations
  model.associate = (models) => {
    model.belongsTo(models.Notification, {
      foreignKey: 'notification_id',
      as: 'Notification'
    });
    
    model.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
  };

  return model;
};

module.exports = NotificationRecipient;