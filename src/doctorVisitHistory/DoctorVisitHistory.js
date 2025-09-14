const { DataTypes } = require('sequelize');

const DoctorVisitHistory = (sequelize) => {
  return sequelize.define('DoctorVisitHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    doctor_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT
    },
    confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    sales_rep_id: {
      type: DataTypes.UUID
    },
    user_name: {
      type: DataTypes.STRING(255)
    }
  }, {
    tableName: 'doctor_visit_history',
    timestamps: true,
    underscored: true
  });
};

module.exports = DoctorVisitHistory;