// src/services/email.service.js

const nodemailer = require('nodemailer');

class EmailService {
    static getTransporter() {
        return nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // Use TLS
            auth: {
                user: process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com',
                pass: process.env.EMAIL_PASS || 'ldgmqixyufjdzylv',
            },
        });
    }

    static async sendMail({ to, subject, text, html }) {
        const transporter = this.getTransporter();
        const mailOptions = {
            from: '"GlucksCare Pharmaceuticals" <gluckscarepharmaceuticals@gmail.com>',
            to,
            subject,
            text,
            html
        };
        return transporter.sendMail(mailOptions);
    }
}

module.exports = EmailService;
