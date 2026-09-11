const nodemailer = require('nodemailer');
const EmailService = require('../services/email.service');

// GET current SMTP settings
const getSmtpSettings = async (req, res) => {
  try {
    const models = req.db || (req.app && req.app.get('models')) || require('../config/database');
    const { SmtpSetting, User } = models;

    let setting = null;
    if (SmtpSetting) {
      setting = await SmtpSetting.findOne({
        include: User ? [
          {
            model: User,
            as: 'UpdatedByUser',
            attributes: ['id', 'name', 'email']
          }
        ] : [],
        order: [['updated_at', 'DESC']]
      }).catch(async () => {
        // Fallback without association if UpdatedByUser alias isn't registered
        return await SmtpSetting.findOne({ order: [['updated_at', 'DESC']] });
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
          emailPass: setting.emailPass,
          fromName: setting.fromName,
          fromEmail: setting.fromEmail || setting.emailUser,
          updatedAt: setting.updated_at,
          updatedBy: setting.UpdatedByUser ? setting.UpdatedByUser.name : null
        }
      });
    }

    // If no settings exist yet in tenant database:
    // Only GlucksCare main tenant defaults to .env; any other new company sees blank template
    const isMainGlucksCare = !req.tenant || req.tenant.slug === 'gluckscare';

    return res.json({
      success: true,
      data: {
        host: isMainGlucksCare ? (process.env.EMAIL_HOST || 'smtp.gmail.com') : 'smtp.gmail.com',
        port: isMainGlucksCare ? (parseInt(process.env.EMAIL_PORT, 10) || 587) : 587,
        secure: isMainGlucksCare ? (process.env.EMAIL_SECURE === 'true') : false,
        emailUser: isMainGlucksCare ? (process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com') : '',
        emailPass: isMainGlucksCare ? (process.env.EMAIL_PASS || 'anxthpipchtlgfsl') : '',
        fromName: isMainGlucksCare ? (process.env.EMAIL_FROM_NAME || 'GlucksCare Pharmaceuticals') : (req.tenant?.name || ''),
        fromEmail: isMainGlucksCare ? (process.env.EMAIL_FROM || process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com') : '',
        updatedAt: null,
        updatedBy: isMainGlucksCare ? 'Default (.env)' : null
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
    const models = req.db || (req.app && req.app.get('models')) || require('../config/database');
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

    const isMainGlucksCare = !req.tenant || req.tenant.slug === 'gluckscare';
    const fallbackName = isMainGlucksCare ? 'GlucksCare Pharmaceuticals' : (req.tenant?.name || 'Company ERP');

    const updatePayload = {
      host: host ? host.trim() : 'smtp.gmail.com',
      port: port ? parseInt(port, 10) : 587,
      secure: secure === true || secure === 'true',
      emailUser: emailUser.trim(),
      emailPass: emailPass.trim(),
      fromName: fromName ? fromName.trim() : fallbackName,
      fromEmail: fromEmail ? fromEmail.trim() : emailUser.trim(),
      updatedBy: req.user?.id || null
    };

    if (setting) {
      await setting.update(updatePayload);
    } else {
      setting = await SmtpSetting.create(updatePayload);
    }

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

// TEST SMTP Connection & Send Test Email
const testSmtpSettings = async (req, res) => {
  try {
    const { host, port, secure, emailUser, emailPass, toEmail } = req.body;

    if (!emailUser || !emailPass) {
      return res.status(400).json({
        success: false,
        message: 'Email user and password are required to test SMTP'
      });
    }

    if (!toEmail) {
      return res.status(400).json({
        success: false,
        message: 'Recipient test email address is required'
      });
    }

    const transporter = nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: port ? parseInt(port, 10) : 587,
      secure: secure === true || secure === 'true',
      auth: {
        user: emailUser.trim(),
        pass: emailPass.trim()
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();

    const mailOptions = {
      from: `"${req.body.fromName || 'ERP Test'}" <${req.body.fromEmail || emailUser}>`,
      to: toEmail.trim(),
      subject: '✅ SMTP Configuration Test - ERP System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 8px;">
          <h2 style="color: #4F46E5;">SMTP Connection Successful!</h2>
          <p>This is a test email sent from your ERP System to verify your SMTP email settings.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">
            <strong>Configured Host:</strong> ${host || 'smtp.gmail.com'}<br>
            <strong>Port:</strong> ${port || 587}<br>
            <strong>Sender User:</strong> ${emailUser}<br>
            <strong>Timestamp:</strong> ${new Date().toISOString()}
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      message: `Test email sent successfully to ${toEmail}!`,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error testing SMTP:', error);
    return res.status(400).json({
      success: false,
      message: `SMTP Test Failed: ${error.message}`
    });
  }
};

module.exports = {
  getSmtpSettings,
  updateSmtpSettings,
  testSmtpSettings
};
