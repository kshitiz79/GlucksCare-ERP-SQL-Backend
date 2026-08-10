// src/userActivityLog/userActivityLogController.js

const { UserActivityLog, User } = require('../config/database');
const { Op } = require('sequelize');

const getActivityLogs = async (req, res) => {
    try {
        const allowedRoles = ['Super Admin', 'Admin', 'Opps Team'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                msg: 'Access denied. Admin privileges required.'
            });
        }

        const { search, action, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const where = {};
        if (action) {
            where.action = action;
        }

        if (search) {
            where[Op.or] = [
                { email: { [Op.iLike]: `%${search}%` } },
                { action: { [Op.iLike]: `%${search}%` } },
                { device_id: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows: logs } = await UserActivityLog.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
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
            data: logs,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching activity logs:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
};

module.exports = {
    getActivityLogs
};
