const { DataTypes } = require('sequelize');

const SalesTarget = (sequelize) => {
  const SalesTargetModel = sequelize.define('SalesTarget', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    target_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    target_month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 12
      }
    },
    target_year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2020
      }
    },
    completion_deadline: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'Active',
      validate: {
        isIn: [['Active', 'Completed', 'Overdue', 'Cancelled']]
      }
    },
    achieved_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    achievement_percentage: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    notes: {
      type: DataTypes.TEXT
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
    tableName: 'sales_targets',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'target_month', 'target_year']
      }
    ]
  });

  return SalesTargetModel;
};

module.exports = SalesTarget;