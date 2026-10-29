// src/platform/payuService.js
// PayU Gateway Integration Service for SaaS Subscriptions

const crypto = require('crypto');
const { PlatformSetting, DEFAULT_PAYU_CONFIG } = require('./masterDb');

/**
 * Sanitize and normalize PayU merchant key (replaces accidental Cyrillic homoglyphs and whitespace)
 */
function normalizePayuKey(rawKey) {
  if (!rawKey) return '';
  return String(rawKey)
    .trim()
    .replace(/\u0417/g, '3') // Cyrillic Capital Ze -> 3
    .replace(/\u0437/g, '3') // Cyrillic Small Ze -> 3
    .replace(/\u0421/g, 'C') // Cyrillic Capital Es -> C
    .replace(/\u0441/g, 'c') // Cyrillic Small Es -> c
    .replace(/\u041d/g, 'H') // Cyrillic Capital En -> H
    .replace(/\u043d/g, 'h') // Cyrillic Small En -> h
    .replace(/\u041e/g, 'O') // Cyrillic Capital O -> O
    .replace(/\u043e/g, 'o') // Cyrillic Small O -> o
    .replace(/\u0420/g, 'P') // Cyrillic Capital Er -> P
    .replace(/\u0440/g, 'p') // Cyrillic Small Er -> p
    .replace(/\u0410/g, 'A') // Cyrillic Capital A -> A
    .replace(/\u0430/g, 'a') // Cyrillic Small A -> a
    .replace(/\u0412/g, 'B') // Cyrillic Capital Ve -> B
    .replace(/\u041c/g, 'M') // Cyrillic Capital Em -> M
    .replace(/\u0422/g, 'T') // Cyrillic Capital Te -> T
    .replace(/\u041a/g, 'K') // Cyrillic Capital Ka -> K
    .replace(/\u0425/g, 'X') // Cyrillic Capital Ha -> X
    .replace(/\u0445/g, 'x'); // Cyrillic Small Ha -> x
}

/**
 * Sanitize PayU merchant salt
 */
function normalizePayuSalt(rawSalt) {
  if (!rawSalt) return '';
  return String(rawSalt).trim();
}

/**
 * Load active PayU configuration from database or fallback
 */
async function getActivePayuConfig() {
  try {
    const setting = await PlatformSetting.findByPk('payu_config');
    if (setting && setting.value) {
      const val = setting.value;
      return {
        ...val,
        key: normalizePayuKey(val.key || DEFAULT_PAYU_CONFIG.key),
        salt: normalizePayuSalt(val.salt || DEFAULT_PAYU_CONFIG.salt),
        mode: val.mode || DEFAULT_PAYU_CONFIG.mode || 'LIVE',
        enabled: val.enabled !== undefined ? val.enabled : true
      };
    }
  } catch (err) {
    console.warn('⚠️ Could not load payu_config from database, using defaults:', err.message);
  }
  return {
    ...DEFAULT_PAYU_CONFIG,
    key: normalizePayuKey(DEFAULT_PAYU_CONFIG.key),
    salt: normalizePayuSalt(DEFAULT_PAYU_CONFIG.salt)
  };
}

/**
 * Generate SHA-512 Hash for PayU Payment Request
 * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
function generatePaymentHash({ key, salt, txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '' }) {
  const cleanKey = normalizePayuKey(key);
  const cleanSalt = normalizePayuSalt(salt);
  const formattedAmount = parseFloat(amount).toFixed(2);
  const hashString = `${cleanKey}|${txnid}|${formattedAmount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${cleanSalt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * Verify SHA-512 Hash returned by PayU
 * Formula: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * Or with additionalCharges: sha512(additionalCharges|SALT|status...)
 */
function verifyPaymentHash(payuResponse, salt) {
  const cleanSalt = normalizePayuSalt(salt);
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    status,
    hash,
    additionalCharges,
    udf1 = '',
    udf2 = '',
    udf3 = '',
    udf4 = '',
    udf5 = ''
  } = payuResponse;

  const cleanKey = normalizePayuKey(key);

  let hashSequence = '';
  if (additionalCharges) {
    hashSequence = `${additionalCharges}|${cleanSalt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${parseFloat(amount).toFixed(2)}|${txnid}|${cleanKey}`;
  } else {
    hashSequence = `${cleanSalt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${parseFloat(amount).toFixed(2)}|${txnid}|${cleanKey}`;
  }

  const calculatedHash = crypto.createHash('sha512').update(hashSequence).digest('hex');
  return calculatedHash.toLowerCase() === (hash || '').toLowerCase();
}

/**
 * Build PayU checkout transaction payload
 */
async function initiatePayUPayment({
  tenantId,
  tenantSlug,
  companyName,
  adminName,
  adminEmail,
  adminPhone = '9999999999',
  planName,
  userCount,
  billingCycle,
  amount,
  productinfo: customProductInfo,
  returnUrl,
  cancelUrl
}) {
  const config = await getActivePayuConfig();
  const txnid = `GLUCKS_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
  const productinfo = customProductInfo || `SaaS Subscription: ${planName} (${userCount} Users - ${billingCycle})`;
  const firstname = (adminName || 'Admin').split(' ')[0] || 'Subscriber';
  const email = adminEmail || 'billing@gluckscare.com';
  const phone = adminPhone || '9999999999';

  // UDFs to persist context across PayU redirects
  const udf1 = tenantId || '';
  const udf2 = tenantSlug || '';
  const udf3 = planName || '';
  const udf4 = String(userCount || 10);
  const udf5 = billingCycle || 'annual';

  const hash = generatePaymentHash({
    key: config.key,
    salt: config.salt,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5
  });

  const payuUrl = config.mode === 'LIVE'
    ? 'https://secure.payu.in/_payment'
    : 'https://test.payu.in/_payment';

  return {
    payuUrl,
    mode: config.mode,
    formData: {
      key: config.key,
      txnid,
      amount: parseFloat(amount).toFixed(2),
      productinfo,
      firstname,
      email,
      phone,
      surl: returnUrl,
      furl: cancelUrl,
      hash,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5
    }
  };
}

module.exports = {
  getActivePayuConfig,
  generatePaymentHash,
  verifyPaymentHash,
  initiatePayUPayment,
  normalizePayuKey,
  normalizePayuSalt
};
