// src/mobimgupload/MobImage.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MobImage = sequelize.define('MobImage', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: {
                    msg: 'Title is required'
                },
                len: {
                    args: [1, 255],
                    msg: 'Title must be between 1 and 255 characters'
                }
            }
        },
        image_url: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: {
                    msg: 'Image URL is required'
                },
                isUrl: {
                    msg: 'Must be a valid URL'
                }
            }
        }
    }, {
        tableName: 'mob_images',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                fields: ['title']
            },
            {
                fields: ['created_at']
            }
        ]
    });

    return MobImage;
};
