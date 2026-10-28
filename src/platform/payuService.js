// src/platform/payuService.js
// PayU Gateway Integration Service for SaaS Subscriptions

const crypto = require('crypto');
const { PlatformSetting, DEFAULT_PAYU_CONFIG } = require('./masterDb');

/**
 * Load active PayU configuration from database or fallback
 */
async function getActivePayuConfig() {
  try {
    const setting = await PlatformSetting.findByPk('payu_config');
    if (setting && setting.value) {
      return setting.value;
    }
  } catch (err) {
    console.warn('⚠️ Could not load payu_config from database, using defaults:', err.message);
  }
  return DEFAULT_PAYU_CONFIG;
}

/**
 * Generate SHA-512 Hash for PayU Payment Request
 * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
function generatePaymentHash({ key, salt, txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '' }) {
  const formattedAmount = parseFloat(amount).toFixed(2);
  const hashString = `${key}|${txnid}|${formattedAmount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
  return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * Verify SHA-512 Hash returned by PayU
 * Formula: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * Or with additionalCharges: sha512(additionalCharges|SALT|status...)
 */
function verifyPaymentHash(payuResponse, salt) {
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

  let hashSequence = '';
  if (additionalCharges) {
    hashSequence = `${additionalCharges}|${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${parseFloat(amount).toFixed(2)}|${txnid}|${key}`;
  } else {
    hashSequence = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${parseFloat(amount).toFixed(2)}|${txnid}|${key}`;
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
  returnUrl,
  cancelUrl
}) {
  const config = await getActivePayuConfig();
  const txnid = `GLUCKS_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
  const productinfo = `SaaS Subscription: ${planName} (${userCount} Users - ${billingCycle})`;
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
  initiatePayUPayment
};
