// src/userActivityLog/userActivityLogService.js

const { UserActivityLog } = require('../config/database');

class UserActivityLogService {
    /**
     * Log a user activity
     * @param {Object} req Express request object (optional)
     * @param {Object} data Log details
     * @param {string} data.userId User UUID (optional)
     * @param {string} data.email User email (optional)
     * @param {string} data.action Event action (LOGIN, LOGOUT, FAILED_LOGIN, BIND_DEVICE, etc.)
     * @param {string} data.deviceId Device ID (optional)
     * @param {Object} data.details JSON details object (optional)
     */
    static async logActivity(req, data) {
        try {
            let ipAddress = null;
            let userAgent = null;

            if (req && req.headers) {
                ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
                userAgent = req.headers['user-agent'];
            }

            const TargetModel = req?.db?.UserActivityLog || 
                                data?.db?.UserActivityLog || 
                                (req?.app?.get && req.app.get('models')?.UserActivityLog) || 
                                UserActivityLog;

            const logEntry = await TargetModel.create({
                user_id: data.userId || null,
                email: data.email || null,
                action: data.action,
                ip_address: ipAddress ? ipAddress.toString() : null,
                user_agent: userAgent ? userAgent.toString() : null,
                device_id: data.deviceId || null,
                details: data.details || null
            });

            console.log(`[Activity Log] ${data.action} logged for email: ${data.email || 'unknown'}`);
            return logEntry;
        } catch (err) {
            // Silently catch activity log errors so main auth never fails
            console.warn('[Activity Log Warning]:', err.message);
        }
    }
}

module.exports = UserActivityLogService;
