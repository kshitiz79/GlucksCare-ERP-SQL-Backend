const { DataTypes } = require('sequelize');

const Leave = (sequelize) => {
  return sequelize.define('Leave', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    leave_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'leave_types',
        key: 'id'
      }
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    total_days: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: false,
      validate: {
        min: 0.5
      }
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(
        'Pending', 'Approved', 'Rejected', 'Cancelled', 'Withdrawn'
      ),
      defaultValue: 'Pending'
    },
    applied_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    approval_flow: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    current_approval_level: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    final_approval_date: {
      type: DataTypes.DATE
    },
    rejection_reason: {
      type: DataTypes.TEXT
    },
    documents: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    emergency_contact: {
      type: DataTypes.JSONB
    },
    handover_notes: {
      type: DataTypes.TEXT
    },
    is_half_day: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    half_day_type: {
      type: DataTypes.ENUM('First Half', 'Second Half'),
      allowNull: true, // Allow null values
      validate: {
        // Custom validator to ensure half_day_type is only set when is_half_day is true
        isValidHalfDayType(value) {
          if (this.is_half_day && !value) {
            throw new Error('half_day_type is required when is_half_day is true');
          }
          if (!this.is_half_day && value) {
            throw new Error('half_day_type must be null when is_half_day is false');
          }
        }
      }
    },
    compensatory_off_date: {
      type: DataTypes.DATE
    },
    actual_return_date: {
      type: DataTypes.DATE
    },
    extended_days: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
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
    tableName: 'leaves',
    timestamps: true,
    underscored: true,
    // Add indexes for better query performance
    indexes: [
      {
        fields: ['employee_id']
      },
      {
        fields: ['leave_type_id']
      },
      {
        fields: ['status']
      }
    ]
  });
};

module.exports = Leave;