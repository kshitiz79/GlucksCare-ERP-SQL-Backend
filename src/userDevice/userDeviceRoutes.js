// src/userDevice/userDeviceRoutes.js

const express = require('express');
const { UserDevice, User } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');
const { generateDeviceFingerprint, validateDeviceInfo, getDeviceName } = require('../utils/deviceFingerprint');

const router = express.Router();

/**
 * GET /api/user-devices/my-devices
 * Get all devices for the authenticated user
 */
router.get('/my-devices', authMiddleware, async (req, res) => {
    try {
        const devices = await UserDevice.findAll({
            where: { user_id: req.user.id },
            order: [['last_login', 'DESC']],
            attributes: {
                exclude: ['android_id', 'device_fingerprint'] // Don't expose sensitive data
            }
        });

        res.json({
            success: true,
            data: devices
        });
    } catch (err) {
        console.error('Get my devices error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

/**
 * GET /api/user-devices/user/:userId
 * Admin endpoint - Get all devices for a specific user
 */
router.get('/user/:userId', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        const allowedRoles = ['Super Admin', 'Admin', 'Opps Team'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                msg: 'Access denied. Admin privileges required.'
            });
        }

        const { userId } = req.params;

        const devices = await UserDevice.findAll({
            where: { user_id: userId },
            order: [['last_login', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'employee_code']
                }
            ]
        });

        res.json({
            success: true,
            data: devices
        });
    } catch (err) {
        console.error('Get user devices error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

/**
 * POST /api/user-devices/reset/:userId
 * Admin endpoint - Reset/unbind device for a user
 */
router.post('/reset/:userId', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        const allowedRoles = ['Super Admin', 'Admin', 'Opps Team'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                msg: 'Access denied. Admin privileges required.'
            });
        }

        const { userId } = req.params;
        const { reason } = req.body;

        // Find the user to verify they exist
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: 'User not found'
            });
        }

        // Find all active devices for this user
        const devices = await UserDevice.findAll({
            where: {
                user_id: userId,
                status: 'ACTIVE'
            }
        });

        if (devices.length === 0) {
            return res.status(404).json({
                success: false,
                msg: 'No active device found for this user'
            });
        }

        // Revoke all active devices
        const revokePromises = devices.map(device =>
            device.update({
                status: 'REVOKED',
                is_active: false,
                revoked_by: req.user.id,
                revoked_at: new Date(),
                revoke_reason: reason || 'Admin reset - device replacement or factory reset'
            })
        );

        await Promise.all(revokePromises);

        console.log(`🔓 Admin ${req.user.email} reset device binding for user ${user.email}`);

        res.json({
            success: true,
            msg: `Device binding reset successfully for ${user.name}. User can now login from a new device.`,
            data: {
                revokedDevices: devices.length,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            }
        });
    } catch (err) {
        console.error('Reset device error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

/**
 * POST /api/user-devices/revoke/:deviceId
 * Admin endpoint - Revoke a specific device
 */
router.post('/revoke/:deviceId', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        const allowedRoles = ['Super Admin', 'Admin', 'Opps Team'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                msg: 'Access denied. Admin privileges required.'
            });
        }

        const { deviceId } = req.params;
        const { reason } = req.body;

        const device = await UserDevice.findByPk(deviceId, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email']
                }
            ]
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                msg: 'Device not found'
            });
        }

        if (device.status === 'REVOKED') {
            return res.status(400).json({
                success: false,
                msg: 'Device is already revoked'
            });
        }

        await device.update({
            status: 'REVOKED',
            is_active: false,
            revoked_by: req.user.id,
            revoked_at: new Date(),
            revoke_reason: reason || 'Revoked by admin'
        });

        console.log(`🔓 Admin ${req.user.email} revoked device ${device.device_name} for user ${device.user.email}`);

        res.json({
            success: true,
            msg: 'Device revoked successfully',
            data: {
                device: {
                    id: device.id,
                    device_name: device.device_name,
                    status: device.status
                },
                user: device.user
            }
        });
    } catch (err) {
        console.error('Revoke device error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

/**
 * GET /api/user-devices/all
 * Admin endpoint - Get all devices in the system
 */
router.get('/all', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        const allowedRoles = ['Super Admin', 'Admin', 'Opps Team'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                msg: 'Access denied. Admin privileges required.'
            });
        }

        const { status, page = 1, limit = 50 } = req.query;

        const where = {};
        if (status) {
            where.status = status;
        }

        const offset = (page - 1) * limit;

        const { count, rows: devices } = await UserDevice.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['last_login', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'employee_code', 'role']
                }
            ]
        });

        res.json({
            success: true,
            data: {
                devices,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            }
        });
    } catch (err) {
        console.error('Get all devices error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

module.exports = router;
