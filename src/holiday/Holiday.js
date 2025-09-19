const { DataTypes } = require('sequelize');

const Holiday = (sequelize) => {
  return sequelize.define('Holiday', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('National', 'Regional', 'Religious', 'Company', 'Optional'),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    is_recurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    recurring_type: {
      type: DataTypes.ENUM('Yearly', 'Monthly', 'Weekly'),
      defaultValue: null
    },
    applicable_states: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: []
    },
    applicable_roles: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    is_optional: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    max_optional_takers: {
      type: DataTypes.INTEGER,
      defaultValue: null
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#EF4444'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    updated_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'holidays',
    timestamps: true,
    underscored: true
  });

  // Define associations
  model.associate = (models) => {
    model.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'Creator'
    });
    
    model.belongsTo(models.User, {
      foreignKey: 'updated_by',
      as: 'Updater'
    });
  };

  return model;
};

module.exports = Holiday;