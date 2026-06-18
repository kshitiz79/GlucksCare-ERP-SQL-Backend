const { DataTypes } = require('sequelize');

const TourPlanDay = (sequelize) => {
  return sequelize.define('TourPlanDay', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tour_plan_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'tour_plans',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    day_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Field',
      validate: {
        isIn: [['Field', 'Joint work', 'Meeting', 'Office', 'Transit', 'Weekly off', 'Holiday', 'Leave']]
      }
    },
    joint_work_with_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    collaboration_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'None',
      validate: {
        isIn: [['None', 'Pending', 'Accepted', 'Rejected']]
      }
    },
    beat_id_1: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'beats',
        key: 'id'
      }
    },
    beat_id_2: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'beats',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'tour_plan_days',
    timestamps: true,
    underscored: true
  });
};

module.exports = TourPlanDay;
