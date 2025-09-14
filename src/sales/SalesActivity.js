const { DataTypes } = require('sequelize');

const SalesActivity = (sequelize) => {
  return sequelize.define('SalesActivity', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    doctor_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    sales_rep: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    call_notes: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    user_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    date_time: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'sales_activities',
    timestamps: true,
    underscored: true
  });
};

module.exports = SalesActivity;