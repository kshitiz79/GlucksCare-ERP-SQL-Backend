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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 6px; color: #222222;">
          <h2 style="margin-top: 0; color: #111827; font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;">SMTP Connection Successful</h2>
          <p style="font-size: 14px; line-height: 1.5; color: #333333;">This is a test email sent from your ERP System to verify your SMTP email settings.</p>
          <div style="font-size: 12px; color: #555555; background: #fafafa; padding: 12px; border: 1px solid #e5e7eb; border-radius: 4px; margin-top: 16px; line-height: 1.5;">
            <strong>Configured Host:</strong> ${host || 'smtp.gmail.com'}<br>
            <strong>Port:</strong> ${port || 587}<br>
            <strong>Sender User:</strong> ${emailUser}<br>
            <strong>Timestamp:</strong> ${new Date().toISOString()}
          </div>
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

// SEND BULK EMAIL to all users, specific role, or selected users
const sendBulkEmail = async (req, res) => {
  try {
    const models = req.db || (req.app && req.app.get('models')) || require('../config/database');
    const { User } = models;
    const { Op } = require('sequelize');

    const {
      targetType = 'all', // 'all', 'role', 'selected'
      userIds = [],
      role = '',
      subject,
      message,
      htmlMessage
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email subject is required'
      });
    }

    if (!message && !htmlMessage) {
      return res.status(400).json({
        success: false,
        message: 'Email body content is required'
      });
    }

    // Determine target users
    const whereClause = {
      is_active: true,
      email: {
        [Op.and]: [
          { [Op.ne]: null },
          { [Op.ne]: '' }
        ]
      }
    };

    if (targetType === 'role' && role) {
      whereClause.role = role;
    } else if (targetType === 'selected') {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one recipient user'
        });
      }
      whereClause.id = { [Op.in]: userIds };
    }

    const recipients = await User.findAll({
      where: whereClause,
      attributes: ['id', 'name', 'email', 'role']
    });

    if (recipients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active users found with valid email addresses for the selected criteria'
      });
    }

    // Get active SMTP configuration from DB / .env
    const emailConfig = await EmailService.getConfig(models);

    const results = {
      total: recipients.length,
      successCount: 0,
      failedCount: 0,
      failures: []
    };

    const createHtmlTemplate = (userName, bodyContent) => {
      const personalizedBody = (bodyContent || '').replace(/\{name\}/gi, userName || 'Team Member');
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: #ffffff;
              margin: 0;
              padding: 20px;
              color: #222222;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 24px;
            }
            .header {
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
              color: #111827;
            }
            .content {
              font-size: 14px;
              line-height: 1.6;
              color: #333333;
              white-space: pre-wrap;
            }
            .footer {
              margin-top: 24px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #666666;
              line-height: 1.5;
            }
            .footer p {
              margin: 4px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${emailConfig.fromName || 'GlucksCare ERP'}</h1>
            </div>
            <div class="content">${personalizedBody}</div>
            <div class="footer">
              <p>This message was sent from ${emailConfig.fromName || 'GlucksCare ERP'}.</p>
              <p>Sender: ${emailConfig.fromEmail || emailConfig.user}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    };

    // Send emails sequentially or in small parallel batches
    for (const recipient of recipients) {
      try {
        const html = htmlMessage || createHtmlTemplate(recipient.name, message);
        const text = (message || '').replace(/\{name\}/gi, recipient.name || 'Team Member');

        await EmailService.sendMail({
          to: recipient.email,
          subject: subject.trim(),
          text,
          html,
          models
        });

        results.successCount++;
      } catch (sendErr) {
        console.error(`Failed to send email to ${recipient.email}:`, sendErr.message);
        results.failedCount++;
        results.failures.push({
          email: recipient.email,
          name: recipient.name,
          error: sendErr.message
        });
      }
    }

    return res.json({
      success: true,
      message: `Bulk email process completed: ${results.successCount} sent, ${results.failedCount} failed`,
      data: {
        total: results.total,
        sent: results.successCount,
        failed: results.failedCount,
        sender: {
          email: emailConfig.fromEmail || emailConfig.user,
          name: emailConfig.fromName,
          host: emailConfig.host
        },
        failures: results.failures
      }
    });

  } catch (error) {
    console.error('Error in sendBulkEmail:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while sending bulk email'
    });
  }
};

module.exports = {
  getSmtpSettings,
  updateSmtpSettings,
  testSmtpSettings,
  sendBulkEmail
};
