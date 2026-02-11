// src/forwardingNote/forwardingNote.js

const { DataTypes } = require('sequelize');

const ForwardingNote = (sequelize) => {
    return sequelize.define('ForwardingNote', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },

        invoice_tracking_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'invoice_tracking',
                key: 'id'
            },
            comment: 'Reference to InvoiceTracking'
        },

        serial_no: {
            type: DataTypes.STRING,
            allowNull: true
        },

        transport_courier_name: {
            type: DataTypes.STRING,
            allowNull: true
        },

        customer_name: {
            type: DataTypes.STRING,
            allowNull: true
        },

        origin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        origin_address: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        destination: {
            type: DataTypes.STRING,
            allowNull: true
        },
        to_city: {
            type: DataTypes.STRING,
            allowNull: true
        },
        to_pincode: {
            type: DataTypes.STRING,
            allowNull: true
        },
        to_state: {
            type: DataTypes.STRING,
            allowNull: true
        },
        to_mobile: {
            type: DataTypes.STRING,
            allowNull: true
        },

        invoice_no: {
            type: DataTypes.STRING,
            allowNull: true
        },

        invoice_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },

        cases: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0,
            comment: 'Invoice amount'
        },

        permit_no: {
            type: DataTypes.STRING,
            allowNull: true
        },

        commodity: {
            type: DataTypes.STRING,
            allowNull: true
        },

        freight_note: {
            type: DataTypes.STRING,
            defaultValue: 'FREIGHT TO BE BILLED'
        },
        created_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        updated_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        }

    }, {
        tableName: 'forwarding_notes',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                fields: ['invoice_tracking_id']
            },
            {
                fields: ['invoice_no']
            }
        ]
    });
};

module.exports = ForwardingNote;
