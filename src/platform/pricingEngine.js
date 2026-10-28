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
function calculateSubscriptionPrice(config, usersInput, cycleKey = 'annual') {
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
      gstRate: cfg.gst_rate || 18,
      gstAmount: null,
      totalAmount: null
    };
  }

  const cycle = cfg.billing_cycles[cycleKey] || cfg.billing_cycles.annual;
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

  // Tier-based calculation for entire volume: userCount * rate * months
  const monthlyTotal = userCount * ratePerUserPerMonth;
  const subtotal = monthlyTotal * months;
  const gstRate = typeof cfg.gst_rate === 'number' ? cfg.gst_rate : 18;
  const gstAmount = Math.round((subtotal * (gstRate / 100)) * 100) / 100;
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

  // Savings calculation against standard monthly rate
  const standardMonthlyRate = cfg.billing_cycles.monthly?.rate || 249;
  const standardEquivalentTotal = userCount * standardMonthlyRate * months;
  const totalSavings = Math.max(0, standardEquivalentTotal - subtotal);

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
