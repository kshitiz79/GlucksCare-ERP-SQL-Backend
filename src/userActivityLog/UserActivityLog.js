// src/userActivityLog/UserActivityLog.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserActivityLog = sequelize.define('UserActivityLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true
        },
        action: {
            type: DataTypes.STRING, // LOGIN, LOGOUT, FAILED_LOGIN, BIND_DEVICE, REVOKE_DEVICE, PASSWORD_RESET
            allowNull: false
        },
        ip_address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        device_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        details: {
            type: DataTypes.JSONB,
            allowNull: true
        }
    }, {
        tableName: 'user_activity_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        underscored: true
    });

    return UserActivityLog;
};
