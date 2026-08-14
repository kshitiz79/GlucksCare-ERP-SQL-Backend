const { DataTypes } = require('sequelize');

const LocationPing = (sequelize) => {
    return sequelize.define('LocationPing', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        client_fix_id: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' }
        },
        device_id: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        session_id: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: false
        },
        longitude: {
            type: DataTypes.DECIMAL(10, 7),
            allowNull: false
        },
        accuracy_m: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true
        },
        speed_mps: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true
        },
        bearing_deg: {
            type: DataTypes.DECIMAL(6, 2),
            allowNull: true
        },
        provider: {
            type: DataTypes.STRING(50),
            defaultValue: 'fused'
        },
        is_mock_location: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        battery_pct: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        network_type: {
            type: DataTypes.STRING(30),
            allowNull: true
        },
        network_strength: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        device_time_utc: {
            type: DataTypes.DATE,
            allowNull: false
        },
        server_received_at_utc: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        clock_skew_seconds: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'location_pings',
        timestamps: false
    });
};

module.exports = LocationPing;
