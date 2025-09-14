const { DataTypes } = require('sequelize');

const PayrollSetting = (sequelize) => {
  return sequelize.define('PayrollSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    full_day_hours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 11.00,
      validate: {
        min: 1,
        max: 24
      }
    },
    half_day_hours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 4.00,
      validate: {
        min: 1,
        max: 12
      }
    },
    working_days_per_month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 26,
      validate: {
        min: 20,
        max: 31
      }
    },
    full_day_deduction: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    half_day_deduction: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 50,
      validate: {
        min: 0,
        max: 100
      }
    },
    absent_deduction: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 100,
      validate: {
        min: 0,
        max: 100
      }
    },
    leave_deduction: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    overtime_rate: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 1.50,
      validate: {
        min: 1,
        max: 3
      }
    },
    hra: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 40,
      validate: {
        min: 0,
        max: 100
      }
    },
    da: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 12,
      validate: {
        min: 0,
        max: 100
      }
    },
    pf: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 12,
      validate: {
        min: 0,
        max: 20
      }
    },
    esi: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.75,
      validate: {
        min: 0,
        max: 5
      }
    },
    late_coming_deduction: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 10,
      validate: {
        min: 0,
        max: 100
      }
    },
    enable_overtime: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    enable_hra: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    enable_da: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    enable_pf: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    enable_esi: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    enable_half_day_deduction: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    enable_absent_deduction: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    enable_leave_deduction: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    enable_late_coming_deduction: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    shift_id: {
      type: DataTypes.UUID,
      unique: true
    },
    created_by: {
      type: DataTypes.UUID
    },
    updated_by: {
      type: DataTypes.UUID
    }
  }, {
    tableName: 'payroll_settings',
    timestamps: true,
    underscored: true
  });
};

module.exports = PayrollSetting;