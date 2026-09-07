const nodemailer = require('nodemailer');
const EmailService = require('../services/email.service');

// GET current SMTP settings
const getSmtpSettings = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { SmtpSetting, User } = models;

    let setting = null;
    if (SmtpSetting) {
      setting = await SmtpSetting.findOne({
        include: [
          {
            model: User,
            as: 'UpdatedByUser',
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [['updated_at', 'DESC']]
      });
    }

    if (setting) {
      return res.json({
        success: true,
        data: {
          id: setting.id,
          host: setting.host,
          port: setting.port,
          secure: setting.secure,
          emailUser: setting.emailUser,
          emailPass: setting.emailPass, // Admin can view/edit the app password
          fromName: setting.fromName,
          fromEmail: setting.fromEmail || setting.emailUser,
          updatedAt: setting.updated_at,
          updatedBy: setting.UpdatedByUser ? setting.UpdatedByUser.name : null
        }
      });
    }

    // Default to .env if DB not populated yet
    return res.json({
      success: true,
      data: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        emailUser: process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com',
        emailPass: process.env.EMAIL_PASS || 'anxthpipchtlgfsl',
        fromName: process.env.EMAIL_FROM_NAME || 'GlucksCare Pharmaceuticals',
        fromEmail: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com',
        updatedAt: null,
        updatedBy: 'Default (.env)'
      }
    });
  } catch (error) {
    console.error('Error in getSmtpSettings:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE SMTP settings
const updateSmtpSettings = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { SmtpSetting } = models;
    const { host, port, secure, emailUser, emailPass, fromName, fromEmail } = req.body;

    if (!emailUser || !emailPass) {
      return res.status(400).json({
        success: false,
        message: 'Email User (EMAIL_USER) and App Password (EMAIL_PASS) are required'
      });
    }

    let setting = await SmtpSetting.findOne({
      order: [['updated_at', 'DESC']]
    });

    const updatePayload = {
      host: host || 'smtp.gmail.com',
      port: port ? parseInt(port, 10) : 587,
      secure: secure === true || secure === 'true',
      emailUser: emailUser.trim(),
      emailPass: emailPass.trim(),
      fromName: fromName ? fromName.trim() : 'GlucksCare Pharmaceuticals',
      fromEmail: fromEmail ? fromEmail.trim() : emailUser.trim(),
      updatedBy: req.user?.id || null
    };

    if (setting) {
      await setting.update(updatePayload);
    } else {
      setting = await SmtpSetting.create(updatePayload);
    }

    // Invalidate cached nodemailer transporter
    EmailService.invalidateCache();

    return res.json({
      success: true,
      message: 'SMTP settings updated successfully',
      data: {
        id: setting.id,
        host: setting.host,
        port: setting.port,
        secure: setting.secure,
        emailUser: setting.emailUser,
        emailPass: setting.emailPass,
        fromName: setting.fromName,
        fromEmail: setting.fromEmail,
        updatedAt: setting.updated_at
      }
    });
  } catch (error) {
    console.error('Error in updateSmtpSettings:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// TEST SMTP settings by sending a test email
const testSmtpSettings = async (req, res) => {
  try {
    const { testEmail, host, port, secure, emailUser, emailPass, fromName, fromEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Test recipient email address is required'
      });
    }

    // Determine config to use
    let config = {
      host: host || 'smtp.gmail.com',
      port: port ? parseInt(port, 10) : 587,
      secure: secure === true || secure === 'true',
      user: emailUser ? emailUser.trim() : null,
      pass: emailPass ? emailPass.trim() : null,
      fromName: fromName ? fromName.trim() : 'GlucksCare Pharmaceuticals',
      fromEmail: fromEmail ? fromEmail.trim() : (emailUser || 'gluckscarepharmaceuticals@gmail.com')
    };

    // If user and pass are not provided in request, get from DB/env
    if (!config.user || !config.pass) {
      const activeConfig = await EmailService.getConfig(req.app.get('models'));
      config.user = config.user || activeConfig.user;
      config.pass = config.pass || activeConfig.pass;
    }

    const testTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });

    const info = await testTransporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail || config.user}>`,
      to: testEmail.trim(),
      subject: 'GlucksCare ERP - SMTP Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #2563eb;">✅ SMTP Configuration Verified</h2>
          <p>Hello,</p>
          <p>This is a test email sent from your <strong>GlucksCare ERP Admin Dashboard</strong> to verify your SMTP Email configuration.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;" />
          <p style="font-size: 13px; color: #6b7280;">
            <strong>SMTP Host:</strong> ${config.host}<br/>
            <strong>SMTP Port:</strong> ${config.port}<br/>
            <strong>Sender Email:</strong> ${config.user}<br/>
            <strong>Sent At:</strong> ${new Date().toLocaleString()}
          </p>
          <p style="color: #10b981; font-weight: bold;">Your email service is working properly!</p>
        </div>
      `
    });

    return res.json({
      success: true,
      message: `Test email successfully sent to ${testEmail}!`,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error in testSmtpSettings:', error);
    return res.status(400).json({
      success: false,
      message: `Failed to send test email: ${error.message}`
    });
  }
};

module.exports = {
  getSmtpSettings,
  updateSmtpSettings,
  testSmtpSettings
};
