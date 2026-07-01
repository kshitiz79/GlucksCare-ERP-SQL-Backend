const { DataTypes } = require('sequelize');

const OfflineBgTracking = (sequelize) => {
    return sequelize.define('OfflineBgTracking', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' }
        },
        device_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        entity_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        entity_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        payload: {
            type: DataTypes.JSON,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('PENDING', 'FAILED', 'SUCCESS'),
            defaultValue: 'PENDING'
        },
        retry_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        created_at_utc: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        last_attempt_utc: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'offline_bg_tracking',
        timestamps: false
    });
};

module.exports = OfflineBgTracking;
