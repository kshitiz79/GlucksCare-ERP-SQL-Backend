// src/platform/pricingEngine.js
// Centralized Pharma Sales SaaS Pricing Engine

const { PlatformSetting, DEFAULT_PRICING_CONFIG } = require('./masterDb');

/**
 * Fetch the active pricing configuration from database (with fallback)
 */
async function getActivePricingConfig() {
  try {
    const setting = await PlatformSetting.findByPk('pricing_config');
    if (setting && setting.value) {
      return setting.value;
    }
  } catch (err) {
    console.warn('⚠️ Could not load pricing_config from database, using defaults:', err.message);
  }
  return DEFAULT_PRICING_CONFIG;
}

/**
 * Calculate dynamic subscription cost based on user count and billing cycle.
 * Rules:
 * - Minimum users enforced (default 10)
 * - Tier-based flat pricing (NOT progressive)
 * - Volume pricing primarily applies to Annual billing
 * - 1001+ users returns custom/enterprise flag
 * - Dynamic GST calculation
 */
function calculateSubscriptionPrice(config, usersInput, cycleKey = 'annual', options = {}) {
  const cfg = config || DEFAULT_PRICING_CONFIG;
  const rawUsers = parseInt(usersInput, 10);
  const minUsers = cfg.minimum_users || 10;
  
  // Safe user count (minimum 10)
  const userCount = Math.max(minUsers, isNaN(rawUsers) ? minUsers : rawUsers);
  const enterpriseThreshold = cfg.enterprise_threshold || 1001;

  // Enterprise Custom Pricing condition
  if (userCount >= enterpriseThreshold) {
    return {
      isEnterprise: true,
      customPricing: true,
      userCount,
      minimumUsers: minUsers,
      billingCycle: cycleKey,
      message: 'Custom pricing for large pharmaceutical organizations (1,001+ Users)',
      ratePerUserPerMonth: null,
      subtotal: null,
      subscriptionSubtotal: null,
      setupFee: 0,
      setupFeeEnabled: !!cfg.setup_fee_enabled,
      gstRate: cfg.gst_rate || 18,
      gstAmount: null,
      totalAmount: null
    };
  }

  const cycle = (cfg.billing_cycles && cfg.billing_cycles[cycleKey]) || DEFAULT_PRICING_CONFIG.billing_cycles[cycleKey] || DEFAULT_PRICING_CONFIG.billing_cycles.annual;
  const months = cycle.months || 12;
  let ratePerUserPerMonth = cycle.rate;
  let activeTier = null;

  if (cycleKey === 'annual') {
    // Find volume tier
    const tiers = cfg.volume_tiers || DEFAULT_PRICING_CONFIG.volume_tiers;
    activeTier = tiers.find(t => userCount >= t.min_users && userCount <= t.max_users);
    if (activeTier) {
      ratePerUserPerMonth = activeTier.rate;
    } else {
      ratePerUserPerMonth = cycle.rate;
    }
  }

  // Tier-based calculation for subscription: userCount * rate * months
  const monthlyTotal = userCount * ratePerUserPerMonth;
  const subscriptionSubtotal = monthlyTotal * months;

  // One-Time Setup Fee for 1st-Time Clients
  const isFirstTime = typeof options === 'boolean' ? options : (options.isFirstTime !== false);
  const setupFeeEnabled = cfg.setup_fee_enabled !== false;
  const setupFee = (isFirstTime && setupFeeEnabled) ? (Number(cfg.setup_fee) || 0) : 0;
  const setupFeeLabel = cfg.setup_fee_label || 'One-Time Onboarding & Implementation Setup Fee';

  const subtotal = subscriptionSubtotal + setupFee;
  const gstRate = typeof cfg.gst_rate === 'number' ? cfg.gst_rate : 18;
  const gstAmount = Math.round((subtotal * (gstRate / 100)) * 100) / 100;
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

  // Savings calculation against standard monthly rate
  const standardMonthlyRate = (cfg.billing_cycles && cfg.billing_cycles.monthly?.rate) || 249;
  const standardEquivalentTotal = userCount * standardMonthlyRate * months;
  const totalSavings = Math.max(0, standardEquivalentTotal - subscriptionSubtotal);

  return {
    isEnterprise: false,
    customPricing: false,
    currency: cfg.currency || 'INR',
    userCount,
    minimumUsers: minUsers,
    billingCycle: cycleKey,
    cycleLabel: cycle.label,
    months,
    billingFrequencyText: cycle.billingText,
    ratePerUserPerMonth,
    monthlyTotal,
    subscriptionSubtotal,
    setupFee,
    setupFeeEnabled,
    setupFeeLabel,
    isFirstTime,
    subtotal,
    gstRate,
    gstAmount,
    totalAmount,
    totalSavings,
    activeTier: activeTier ? {
      label: activeTier.label,
      minUsers: activeTier.min_users,
      maxUsers: activeTier.max_users,
      rate: activeTier.rate
    } : null
  };
}

module.exports = {
  getActivePricingConfig,
  calculateSubscriptionPrice
};
