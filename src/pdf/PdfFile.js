// models/pdffile.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('PdfFile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    file_url: { type: DataTypes.STRING(500), allowNull: false },
    file_key: { type: DataTypes.STRING(255), allowNull: false },
    type: { type: DataTypes.STRING(20), defaultValue: 'pdf', allowNull: false },
    uploaded_by: { type: DataTypes.UUID, allowNull: true },
    product_id: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'pdf_files',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
};
