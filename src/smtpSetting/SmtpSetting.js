const { DataTypes } = require('sequelize');

const SmtpSetting = (sequelize) => {
  return sequelize.define('SmtpSetting', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    host: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'smtp.gmail.com'
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 587
    },
    secure: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    emailUser: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'email_user',
      defaultValue: 'gluckscarepharmaceuticals@gmail.com'
    },
    emailPass: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'email_pass'
    },
    fromName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'from_name',
      defaultValue: 'GlucksCare Pharmaceuticals'
    },
    fromEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'from_email'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'updated_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'smtp_settings',
    timestamps: true,
    underscored: true
  });
};

module.exports = SmtpSetting;
