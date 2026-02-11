// src/invoiceTracking/InvoiceTracking.js

const { DataTypes } = require('sequelize');

const InvoiceTracking = (sequelize) => {
  return sequelize.define('InvoiceTracking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    party_name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Stockist name (party name)'
    },
    stockist_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stockists',
        key: 'id'
      },
      comment: 'Reference to stockist table'
    },
    invoice_number: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Invoice number'
    },
    invoice_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Invoice date'
    },
    invoice_image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Cloudinary URL for invoice image'
    },
    invoice_image_public_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Cloudinary public ID for image management'
    },
    tracking_link: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Courier tracking link'
    },
    awb_number: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Air Waybill number'
    },
    courier_company_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Courier company name (e.g., Blue Dart, DTDC, etc.)'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Invoice amount'
    },
    status: {
      type: DataTypes.ENUM('pending', 'shipped', 'in_transit', 'delivered', 'cancelled'),
      defaultValue: 'pending',
      comment: 'Invoice/shipment status'
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional remarks or notes'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User who created this record'
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User who last updated this record'
    }
  }, {
    tableName: 'invoice_tracking',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['stockist_id']
      },
      {
        fields: ['invoice_number']
      },
      {
        fields: ['awb_number']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_by']
      }
    ]
  });
};

module.exports = InvoiceTracking;