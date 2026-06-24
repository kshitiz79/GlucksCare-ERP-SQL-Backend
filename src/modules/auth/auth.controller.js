// src/modules/auth/auth.controller.js

const authService = require('./auth.service');

const handleControllerError = (err, res, defaultMessage = 'Server error') => {
    console.error(`${defaultMessage}:`, err);
    
    // Sequelize unique constraint error mapping
    if (err.name === 'SequelizeUniqueConstraintError') {
        const field = err.errors[0].path;
        const message = `${field === 'email' ? 'Email' : field === 'employee_code' ? 'Employee Code' : field} already exists`;
        return res.status(400).json({
            msg: message,
            error: message
        });
    }

    // Sequelize validation error mapping
    if (err.name === 'SequelizeValidationError') {
        const messages = err.errors.map(e => e.message);
        return res.status(400).json({
            msg: messages[0],
            errors: messages
        });
    }

    // Custom status code mapping
    if (err.statusCode) {
        // Build correct response formats matching legacy routes
        
        // 1. Passwordless / OTP Email flows return format { success, msg, ... }
        if (
            defaultMessage === 'Email login error' || 
            defaultMessage === 'Check email registered error' ||
            defaultMessage === 'Send email OTP error' ||
            defaultMessage === 'Verify email OTP error'
        ) {
            const response = {
                success: false,
                msg: err.message
            };
            if (err.error) response.error = err.error;
            if (err.data) response.data = err.data;
            return res.status(err.statusCode).json(response);
        }

        // 2. Device fingerprinting flows return format { success: false, msg, error, deviceMismatch/deviceInUse, ... }
        if (err.deviceMismatch) {
            return res.status(err.statusCode).json({
                success: false,
                msg: err.message,
                error: err.error,
                deviceMismatch: true,
                registeredDevice: err.registeredDevice
            });
        }

        if (err.deviceInUse) {
            return res.status(err.statusCode).json({
                success: false,
                msg: err.message,
                error: err.error,
                deviceInUse: true
            });
        }

        // 3. Regular auth/otp flows return simple format { msg }
        return res.status(err.statusCode).json({ msg: err.message });
    }

    // Generic fallback errors
    if (defaultMessage === 'Login error') {
        return res.status(500).json({ msg: 'Server error during login' });
    }

    if (defaultMessage === 'Get current user error') {
        return res.status(500).json({ msg: 'Server error' });
    }

    if (defaultMessage === 'Verify OTP error') {
        return res.status(500).json({ msg: 'Server error' });
    }

    return res.status(500).json({
        msg: defaultMessage,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

class AuthController {
    static async register(req, res, next) {
        try {
            const result = await authService.register(req.body, req.files);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Register error');
        }
    }

    static async login(req, res, next) {
        try {
            const result = await authService.login(req.body);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Login error');
        }
    }

    static async generateOtp(req, res, next) {
        try {
            const { email } = req.body;
            const result = await authService.generateOtp(email);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Generate OTP error');
        }
    }

    static async verifyOtp(req, res, next) {
        try {
            const { email, otp } = req.body;
            const result = await authService.verifyOtp(email, otp);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Verify OTP error');
        }
    }

    static async emailLogin(req, res, next) {
        try {
            const { email, otp } = req.body;
            const result = await authService.emailLogin(email, otp);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Email login error');
        }
    }

    static async checkEmailRegistered(req, res, next) {
        try {
            const { email } = req.body;
            const result = await authService.checkEmailRegistered(email);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Check email registered error');
        }
    }

    static async sendEmailOtp(req, res, next) {
        try {
            const { email } = req.body;
            const result = await authService.sendEmailOtp(email);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Send email OTP error');
        }
    }

    static async verifyEmailOtp(req, res, next) {
        try {
            const { email, otp } = req.body;
            const result = await authService.verifyEmailOtp(email, otp);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Verify email OTP error');
        }
    }

    static async me(req, res, next) {
        try {
            const result = await authService.me(req.user.id);
            return res.json(result);
        } catch (err) {
            handleControllerError(err, res, 'Get current user error');
        }
    }
}

module.exports = AuthController;
