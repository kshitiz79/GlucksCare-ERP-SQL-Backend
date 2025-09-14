const { DataTypes } = require('sequelize');

const Attendance = (sequelize) => {
  return sequelize.define('Attendance', {
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    punch_sessions: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    current_session: {
      type: DataTypes.INTEGER,
      defaultValue: -1
    },
    auto_breaks: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    total_working_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_break_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM(
        'present', 'absent', 'half_day', 'late', 'on_leave', 'punched_in', 'punched_out'
      ),
      defaultValue: 'absent'
    },
    is_late: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    late_by_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    first_punch_in: {
      type: DataTypes.DATE
    },
    last_punch_out: {
      type: DataTypes.DATE
    },
    expected_punch_in: {
      type: DataTypes.DATE
    },
    expected_punch_out: {
      type: DataTypes.DATE
    },
    shift_id: {
      type: DataTypes.UUID,
      references: {
        model: 'shifts',
        key: 'id'
      }
    },
    overtime_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    notes: {
      type: DataTypes.TEXT
    },
    admin_remarks: {
      type: DataTypes.TEXT
    },
    is_approved: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    approved_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    approved_at: {
      type: DataTypes.DATE
    },
    created_by: {
      type: DataTypes.UUID,
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
    tableName: 'attendance',
    timestamps: true,
    underscored: true
  });
};

module.exports = Attendance;