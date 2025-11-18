const { DataTypes } = require('sequelize');

const DoctorVisit = (sequelize) => {
  const model = sequelize.define('DoctorVisit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    doctor_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8)
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8)
    },
    confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    remark: {
      type: DataTypes.TEXT
    },
    product_id: {
      type: DataTypes.UUID
    }
  }, {
    tableName: 'doctor_visits',
    timestamps: true,
    underscored: true
  });
  
  // Define associations
  model.associate = (models) => {
    model.belongsTo(models.Doctor, {
      foreignKey: 'doctor_id',
      as: 'DoctorInfo'  // Changed alias to avoid conflict
    });
    model.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'UserInfo'  // Added alias for consistency
    });
    if (models.Product) {
      model.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'ProductInfo'  // Added alias for consistency
      });
    }
  };
  
  return model;
};

module.exports = DoctorVisit;