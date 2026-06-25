// Sql-Backend/src/services/whatsappService.js
// Service to manage WhatsApp triggers via RBSH WhatsApp API
const fs = require('fs');
const path = require('path');

let cachedToken = null;

const getSettings = () => {
  const SETTINGS_FILE_PATH = path.join(__dirname, '../../whatsapp_settings.json');
  const DEFAULT_SETTINGS = {
    userCreation: {
      campaignName: 'welcome_message_sr',
      templateId: '2c807ad8-584c-477e-905a-46cece539244'
    }
  };

  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[WhatsApp Service] Error reading settings file:', err);
  }
  return DEFAULT_SETTINGS;
};
let tokenExpiry = 0;

const ensureToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const url = process.env.WHATSAPP_API_URL || 'https://whatsapptools.rbshtools.cloud';
  const apiKey = process.env.WHATSAPP_API_KEY;
  const email = process.env.WHATSAPP_EMAIL || 'gluckscarepharmaceuticals@gmail.com';
  const password = process.env.WHATSAPP_PASSWORD || '*Gluckscare9217331252';

  if (!apiKey) {
    throw new Error('WHATSAPP_API_KEY is not configured in backend env');
  }

  const res = await fetch(`${url}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ email, password })
  });

  const json = await res.json();
  const token = json?.data?.token || json?.token;
  if (!token) {
    throw new Error(json?.message || 'RBSH WhatsApp login failed');
  }

  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    tokenExpiry = payload.exp * 1000;
  } catch (err) {
    tokenExpiry = Date.now() + 23 * 3600 * 1000; // fallback 23 hours
  }

  cachedToken = token;
  return cachedToken;
};

/**
 * Sends a welcome campaign message to the user's mobile number.
 * @param {string} mobileNumber 
 */
const sendWelcomeMessage = async (mobileNumber) => {
  if (!mobileNumber) {
    console.log('[WhatsApp Welcome] No mobile number provided, skipping.');
    return;
  }

  // Clean phone number: remove non-digits
  let phone = mobileNumber.replace(/\D/g, '');
  if (phone.length === 10) {
    phone = '91' + phone; // Add default India country code
  }

  if (!phone) {
    console.log('[WhatsApp Welcome] Invalid mobile number formatting, skipping.');
    return;
  }

  try {
    const token = await ensureToken();
    const url = process.env.WHATSAPP_API_URL || 'https://whatsapptools.rbshtools.cloud';
    
    const settings = getSettings();
    const campaignName = settings?.userCreation?.campaignName || 'welcome_message_sr';
    const templateId = settings?.userCreation?.templateId || '2c807ad8-584c-477e-905a-46cece539244';

    console.log(`[WhatsApp Welcome] Triggering welcome campaign for number: ${phone} (Template: ${campaignName})`);
    const res = await fetch(`${url}/api/campaigns/phone-numbers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        campaignName,
        templateId,
        numbers: [phone]
      })
    });

    const status = res.status;
    const bodyText = await res.text();
    console.log(`[WhatsApp Welcome] Response status: ${status}, body: ${bodyText}`);
  } catch (err) {
    console.error('[WhatsApp Welcome] Error sending welcome message:', err.message);
  }
};

module.exports = {
  sendWelcomeMessage
};
