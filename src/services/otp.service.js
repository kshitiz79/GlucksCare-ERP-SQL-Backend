// src/services/otp.service.js

const EmailService = require('./email.service');

class OtpService {
    static generateOtp() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    static async sendOtpEmail(userEmail, userName, otp) {
        const mailOptions = {
            to: userEmail,
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}`,
            html: `<p>Your OTP code is: <strong>${otp}</strong></p><p>It is valid for 10 minutes.</p>`,
        };
        return EmailService.sendMail(mailOptions);
    }

    static async sendEnhancedOtpEmail(userEmail, userName, otp) {
        const mailOptions = {
            to: userEmail,
            subject: 'Your Login OTP - GlucksCare Pharmaceuticals',
            text: `Your login OTP code is: ${otp}. It is valid for 10 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://gluckscare.com/logo.png" alt="GlucksCare Pharmaceuticals" style="height: 60px;">
                    </div>
                    <h2 style="color: #c71d51; text-align: center; margin-bottom: 20px;">Login Verification Code</h2>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">Your login verification code is:</p>
                    <div style="background-color: #f8f9fa; border: 2px dashed #c71d51; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                    <span style="font-size: 32px; font-weight: bold; color: #c71d51; letter-spacing: 3px;">${otp}</span>
                    </div>
                    <p style="color: #666; font-size: 14px; line-height: 1.6;">This code is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.</p>
                    <p style="color: #666; font-size: 14px; line-height: 1.6;">If you didn't request this code, please ignore this email.</p>
                    <hr style="border: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">© 2025 GlucksCare Pharmaceuticals. All rights reserved.</p>
                </div>
                </div>
            `,
        };
        return EmailService.sendMail(mailOptions);
    }
}

module.exports = OtpService;
