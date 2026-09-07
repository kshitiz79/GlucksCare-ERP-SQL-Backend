// src/services/email.service.js

const nodemailer = require('nodemailer');

let cachedTransporter = null;
let lastLoadedConfig = null;

class EmailService {
    /**
     * Clear cached transporter so next sendMail fetches fresh DB settings
     */
    static invalidateCache() {
        cachedTransporter = null;
        lastLoadedConfig = null;
    }

    /**
     * Get active SMTP configuration from database or fallback to environment variables
     */
    static async getConfig(models = null) {
        try {
            if (models?.SmtpSetting) {
                const setting = await models.SmtpSetting.findOne({
                    order: [['updated_at', 'DESC']]
                });
                if (setting && setting.emailUser && setting.emailPass) {
                    return {
                        host: setting.host || process.env.EMAIL_HOST || 'smtp.gmail.com',
                        port: setting.port || parseInt(process.env.EMAIL_PORT, 10) || 587,
                        secure: setting.secure !== undefined ? setting.secure : false,
                        user: setting.emailUser,
                        pass: setting.emailPass,
                        fromName: setting.fromName || 'GlucksCare Pharmaceuticals',
                        fromEmail: setting.fromEmail || setting.emailUser
                    };
                }
            }
        } catch (err) {
            console.warn('⚠️ Warning: Failed to query SmtpSetting from DB, falling back to .env:', err.message);
        }

        // Fallback to environment variables
        return {
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT, 10) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            user: process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com',
            pass: process.env.EMAIL_PASS || 'anxthpipchtlgfsl',
            fromName: process.env.EMAIL_FROM_NAME || 'GlucksCare Pharmaceuticals',
            fromEmail: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com'
        };
    }

    /**
     * Create and return a nodemailer transporter using active DB/env config
     */
    static async getTransporter(models = null) {
        const config = await this.getConfig(models);

        // Check if cached transporter is valid
        if (
            cachedTransporter &&
            lastLoadedConfig &&
            lastLoadedConfig.user === config.user &&
            lastLoadedConfig.pass === config.pass &&
            lastLoadedConfig.host === config.host &&
            lastLoadedConfig.port === config.port
        ) {
            return { transporter: cachedTransporter, config };
        }

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass
            }
        });

        cachedTransporter = transporter;
        lastLoadedConfig = config;

        return { transporter, config };
    }

    /**
     * Send email with optional html, text, and attachments
     */
    static async sendMail({ to, subject, text, html, attachments = [], models = null }) {
        const { transporter, config } = await this.getTransporter(models);
        const fromAddress = `"${config.fromName}" <${config.fromEmail || config.user}>`;

        const mailOptions = {
            from: fromAddress,
            to,
            subject,
            text,
            html,
            attachments
        };

        return transporter.sendMail(mailOptions);
    }
}

module.exports = EmailService;
