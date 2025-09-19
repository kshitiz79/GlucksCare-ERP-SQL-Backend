const { DataTypes } = require('sequelize');

const Notification = (sequelize) => {
  const model = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    is_broadcast: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'notifications',
    timestamps: true,
    underscored: true
  });

  // Define associations
  model.associate = (models) => {
    model.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'Sender'
    });
    
    model.hasMany(models.NotificationRecipient, {
      foreignKey: 'notification_id',
      as: 'Recipients'
    });
  };

  return model;
};

module.exports = Notification;