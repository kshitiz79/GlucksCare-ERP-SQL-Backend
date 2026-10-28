// src/platform/otpService.js
// Dedicated Security OTP Service for Database Deletion in GlucksCare Master Admin

const nodemailer = require('nodemailer');
const crypto = require('crypto');

// In-memory store for database deletion OTPs: tenantId -> { otp, tenantId, dbName, expiresAt, attempts }
const deletionOtpStore = new Map();

// Configure Nodemailer transporter with Gmail credentials
function getTransporter() {
  const user = process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com';
  const pass = process.env.EMAIL_PASS || 'anxthpipchtlgfsl';

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

/**
 * Generate a 6-digit numeric OTP and send it to the Super Admin email.
 */
async function generateAndSendDeleteOtp({ tenantId, tenantName, dbName, slug, requestedBy = 'Super Admin' }) {
  if (!tenantId || !dbName) {
    throw new Error('Tenant ID and Database Name are required to generate deletion OTP');
  }

  // Block deleting flagship instance
  if (slug === 'gluckscare' || dbName === 'gluckscare_db' || dbName === 'gluckscare_master_db') {
    throw new Error('Action Prohibited: The primary flagship instance database cannot be deleted.');
  }

  // Generate a cryptographically secure 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresInMinutes = 10;
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

  // Save to memory store
  deletionOtpStore.set(String(tenantId), {
    otp,
    tenantId: String(tenantId),
    dbName,
    tenantName,
    expiresAt,
    attempts: 0,
    createdAt: Date.now()
  });

  const targetEmail = process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com';
  const transporter = getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>GlucksCare Master Admin Security Alert</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #b91c1c 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
        .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; }
        .title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
        .body { padding: 32px 28px; }
        .warning-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 13.5px; color: #991b1b; line-height: 1.5; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13.5px; }
        .meta-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
        .meta-table .label { color: #64748b; font-weight: 600; width: 38%; }
        .meta-table .val { color: #0f172a; font-weight: 700; font-family: 'SF Mono', Monaco, Consolas, monospace; }
        .otp-container { text-align: center; margin: 28px 0; }
        .otp-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 8px; }
        .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #b91c1c; background: #fff1f2; border: 2px dashed #fda4af; padding: 16px 24px; border-radius: 12px; display: inline-block; font-family: 'SF Mono', Monaco, Consolas, monospace; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="badge">Critical Security Authorization</div>
          <h1 class="title">Database Deletion OTP</h1>
        </div>
        <div class="body">
          <div class="warning-box">
            <strong>WARNING:</strong> A request was initiated in GlucksCare Master Admin Panel to <strong>PERMANENTLY DROP</strong> a tenant PostgreSQL database. This action will permanently erase all company schemas, data, orders, and MR records.
          </div>

          <table class="meta-table">
            <tr>
              <td class="label">Target Database:</td>
              <td class="val" style="color: #dc2626;">${dbName}</td>
            </tr>
            <tr>
              <td class="label">Company Name:</td>
              <td class="val">${tenantName}</td>
            </tr>
            <tr>
              <td class="label">Tenant Slug:</td>
              <td class="val">${slug}</td>
            </tr>
            <tr>
              <td class="label">Requested By:</td>
              <td class="val">${requestedBy}</td>
            </tr>
            <tr>
              <td class="label">Time:</td>
              <td class="val">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
            </tr>
          </table>

          <div class="otp-container">
            <div class="otp-label">One-Time Verification Passcode (OTP)</div>
            <div class="otp-code">${otp}</div>
            <div style="margin-top: 10px; font-size: 12.5px; color: #64748b;">
              Valid for <strong>${expiresInMinutes} minutes</strong>. Do not disclose this code.
            </div>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 24px;">
            If you did NOT initiate this action, please change your Master Admin credentials immediately and check your server logs.
          </p>
        </div>
        <div class="footer">
          GlucksCare Multi-Tenant Pharma Sales Platform &bull; Master Admin Security System<br>
          Authorized Destination: ${targetEmail}
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"GlucksCare Master Security" <${targetEmail}>`,
    to: targetEmail,
    subject: `🚨 [SECURITY OTP] Authorization to DROP DATABASE "${dbName}" - GlucksCare`,
    text: `GlucksCare Master Admin Database Deletion OTP: ${otp}. Target Database: ${dbName} (${tenantName}). Valid for 10 minutes. If you did not request this, ignore immediately.`,
    html: htmlContent
  };

  await transporter.sendMail(mailOptions);
  console.log(`🔑 [Security OTP] Deletion OTP sent to ${targetEmail} for tenant database "${dbName}"`);

  return {
    success: true,
    message: `Security OTP sent to Super Admin email (${targetEmail})`,
    expiresInMinutes,
    targetDb: dbName,
    targetEmail: targetEmail.replace(/(.{3})(.*)(@.*)/, '$1***$3')
  };
}

/**
 * Verify OTP and confirmation database name.
 */
function verifyDeleteOtp({ tenantId, inputOtp, confirmDbName, actualDbName }) {
  const record = deletionOtpStore.get(String(tenantId));

  if (!record) {
    throw new Error('No OTP request found for this database. Please click "Request Security OTP" first.');
  }

  if (Date.now() > record.expiresAt) {
    deletionOtpStore.delete(String(tenantId));
    throw new Error('Security OTP has expired. Please request a new OTP.');
  }

  // Validate database name confirmation
  if (!confirmDbName || confirmDbName.trim() !== actualDbName) {
    throw new Error(`Database name confirmation mismatch. You must type "${actualDbName}" exactly.`);
  }

  // Validate OTP
  const cleanInputOtp = String(inputOtp || '').trim();
  if (cleanInputOtp !== record.otp) {
    record.attempts += 1;
    if (record.attempts >= 3) {
      deletionOtpStore.delete(String(tenantId));
      throw new Error('Too many invalid attempts. The OTP has been invalidated for security. Please request a new one.');
    }
    const remaining = 3 - record.attempts;
    throw new Error(`Invalid OTP. You have ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
  }

  // Validated! Clear OTP from store
  deletionOtpStore.delete(String(tenantId));
  return true;
}

module.exports = {
  generateAndSendDeleteOtp,
  verifyDeleteOtp
};
