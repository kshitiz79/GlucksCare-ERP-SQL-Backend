const { DataTypes } = require('sequelize');

const MasterEditRequest = (sequelize) => {
  const model = sequelize.define('MasterEditRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'doctor',
      validate: {
        isIn: {
          args: [['doctor', 'chemist', 'stockist']],
          msg: 'Category must be doctor, chemist, or stockist'
        }
      }
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    doctor_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'doctors',
        key: 'id'
      }
    },
    chemist_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'chemists',
        key: 'id'
      }
    },
    stockist_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'stockists',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    head_office_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'head_offices',
        key: 'id'
      }
    },
    current_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    proposed_changes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Pending',
      validate: {
        isIn: {
          args: [['Pending', 'Approved', 'Rejected']],
          msg: 'Status must be Pending, Approved, or Rejected'
        }
      }
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'doctor_edit_requests', // Compatible with existing database table
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['category']
      },
      {
        fields: ['doctor_id']
      },
      {
        fields: ['chemist_id']
      },
      {
        fields: ['stockist_id']
      },
      {
        fields: ['entity_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return model;
};

module.exports = MasterEditRequest;
