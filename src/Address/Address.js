const { DataTypes } = require('sequelize');

const Address = (sequelize) => {
    return sequelize.define('Address', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        contact_person_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        contact_number: {
            type: DataTypes.STRING(15),
            allowNull: false
        },

        address_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },


        address_line_1: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        address_line_2: {
            type: DataTypes.STRING(255),
            allowNull: true
        },

        area_locality: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        post_office: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        district: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        state: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        pincode: {
            type: DataTypes.STRING(6),
            allowNull: false
        },
        country: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: 'India'
        },

        communication_type: {
            type: DataTypes.ENUM('Office', 'Home'),
            defaultValue: 'Office'
        },



        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },

        created_by: {
            type: DataTypes.UUID
        },

        updated_by: {
            type: DataTypes.UUID
        }

    }, {
        tableName: 'addresses',
        timestamps: true,
        underscored: true
    });
};

module.exports = Address;
