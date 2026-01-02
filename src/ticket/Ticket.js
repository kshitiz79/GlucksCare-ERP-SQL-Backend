const { DataTypes } = require('sequelize');

const Ticket = (sequelize) => {
  const model = sequelize.define('Ticket', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    image: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Base64 encoded image or image URL'
    },
    user_id: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    user_name: {
      type: DataTypes.STRING(255)
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'IN PROGRESS',
      validate: {
        isIn: [['IN PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED']]
      }
    }
  }, {
    tableName: 'tickets',
    timestamps: true,
    underscored: true
  });

  // Define associations
  model.associate = (models) => {
    model.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'User'
    });
  };

  return model;
};

module.exports = Ticket;