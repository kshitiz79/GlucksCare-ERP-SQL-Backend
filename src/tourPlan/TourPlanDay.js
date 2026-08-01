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
    joint_work_user_ids: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    },
    collaboration_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'None',
      validate: {
        isIn: [['None', 'Pending', 'Accepted', 'Rejected']]
      }
    },
    handshake_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'None',
      validate: {
        isIn: [['None', 'Pending', 'Completed', 'Failed']]
      }
    },
    handshake_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    handshake_distance_meters: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    handshake_user_lat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    handshake_user_lng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    handshake_partner_lat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    handshake_partner_lng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    handshake_verified_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true
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
    change_request_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'None',
      validate: {
        isIn: [['None', 'Pending', 'Approved', 'Rejected']]
      }
    },
    change_request_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    change_request_beat_id_1: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'beats',
        key: 'id'
      }
    },
    change_request_beat_id_2: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'beats',
        key: 'id'
      }
    },
    change_request_day_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        isIn: [['Field', 'Joint work', 'Meeting', 'Office', 'Transit', 'Weekly off', 'Holiday', 'Leave']]
      }
    },
    change_request_comments: {
      type: DataTypes.TEXT,
      allowNull: true
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
