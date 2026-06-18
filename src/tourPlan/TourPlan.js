const { DataTypes } = require('sequelize');

const TourPlan = (sequelize) => {
  return sequelize.define('TourPlan', {
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
    month: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Draft',
      validate: {
        isIn: [['Draft', 'Submitted', 'Approved', 'Returned']]
      }
    },
    approved_by_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    approved_by_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    approved_by_role: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'tour_plans',
    timestamps: true,
    underscored: true
  });
};

module.exports = TourPlan;
