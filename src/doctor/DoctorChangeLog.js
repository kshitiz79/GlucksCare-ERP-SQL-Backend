const { DataTypes } = require('sequelize');

const DoctorChangeLog = (sequelize) => {
  return sequelize.define('DoctorChangeLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    doctorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'doctor_id',
      comment: 'ID of the affected doctor'
    },
    changeVersion: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: sequelize.literal("nextval('doctor_change_version_seq')"),
      field: 'change_version',
      comment: 'Monotonically increasing version sequence'
    },
    operation: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'operation',
      validate: {
        isIn: [['CREATE', 'UPDATE', 'DELETE']]
      },
      comment: 'Type of change: CREATE, UPDATE, DELETE'
    },
    headOfficeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'head_office_id',
      references: {
        model: 'head_offices',
        key: 'id'
      },
      comment: 'Head office ID for scoping sync per territory'
    },
    areaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'area_id',
      references: {
        model: 'areas',
        key: 'id'
      },
      comment: 'Area ID for scoping sync per area'
    },
    snapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'snapshot',
      comment: 'Snapshot of doctor record data at time of change / tombstone metadata'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'doctor_change_logs',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        fields: ['change_version']
      },
      {
        fields: ['doctor_id']
      },
      {
        fields: ['head_office_id']
      },
      {
        fields: ['created_at']
      }
    ]
  });
};

module.exports = DoctorChangeLog;
