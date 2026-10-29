// src/platform/platformController.js
// Controller for Platform Super Admin operations

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Tenant, PlatformAdmin, PlatformSetting, initMasterDatabase, DEFAULT_PRICING_CONFIG, DEFAULT_PAYU_CONFIG } = require('./masterDb');
const { provisionTenantDatabase, dropTenantDatabase } = require('./tenantProvisioner');
const { getTenantDb } = require('./tenantConnectionManager');
const { getActivePricingConfig, calculateSubscriptionPrice } = require('./pricingEngine');
const { getActivePayuConfig, initiatePayUPayment, verifyPaymentHash, normalizePayuKey, normalizePayuSalt } = require('./payuService');
const { generateAndSendDeleteOtp, verifyDeleteOtp } = require('./otpService');

const JWT_SECRET = process.env.JWT_SECRET || 'gluckscare_platform_master_secret_2026';

// 1. Super Admin Login
async function login(req, res) {
  try {
    await initMasterDatabase();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await PlatformAdmin.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!admin || !admin.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isPlatformAdmin: true
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('❌ Platform Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// 2. Get All Tenants
async function getTenants(req, res) {
  try {
    await initMasterDatabase();

    const tenants = await Tenant.findAll({
      order: [['created_at', 'DESC']]
    });

    const formatted = await Promise.all(tenants.map(async (t) => {
      let realCount = t.active_users || 1;
      let realAdminName = t.admin_name || 'Admin';
      let realAdminEmail = t.admin_email || '';

      try {
        const tenantDb = getTenantDb(t.db_name);
        if (tenantDb && tenantDb.models && tenantDb.models.User) {
          realCount = await tenantDb.models.User.count({ where: { is_active: true } }).catch(() => realCount);

          // Dynamically fetch the real primary Company Admin from the tenant's PostgreSQL database
          const adminUser = await tenantDb.models.User.findOne({
            where: {
              role: { [Op.iLike]: '%admin%' }
            },
            order: [['created_at', 'ASC']],
            attributes: ['name', 'email']
          }).catch(() => null);

          if (adminUser) {
            realAdminName = adminUser.name || realAdminName;
            realAdminEmail = adminUser.email || realAdminEmail;
          }
        }
      } catch (e) {
        // Fallback to recorded count & admin info
      }

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        logoUrl: t.logo_url,
        backendUrl: t.backend_url || process.env.PUBLIC_API_URL || 'https://api.gluckscare.com',
        db_name: t.db_name,
        subdomain: t.subdomain,
        adminName: realAdminName,
        adminEmail: realAdminEmail,
        status: t.status,
        activeUsers: realCount,
        subscriptionPlan: t.subscription_plan || 'Starter',
        subscriptionCategory: t.subscription_category || (t.slug === 'gluckscare' ? 'EXEMPT_NO_PAY' : 'PAID_SAAS'),
        billingCycle: t.billing_cycle || 'annual',
        licensedUsers: t.licensed_users || 25,
        ratePerUser: t.rate_per_user || 200,
        subscriptionStatus: t.subscription_status || 'ACTIVE',
        subscriptionStartDate: t.subscription_start_date,
        subscriptionEndDate: t.subscription_end_date,
        paymentGateway: t.payment_gateway || (t.slug === 'gluckscare' ? 'EXEMPT' : 'PAYU'),
        lastPaymentId: t.last_payment_id,
        lastPaymentAmount: t.last_payment_amount,
        createdAt: t.created_at
      };
    }));

    return res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('❌ Get tenants error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch tenants', error: err.message });
  }
}

// 3. Create Tenant & Dedicated Database
async function createTenant(req, res) {
  try {
    const { name, slug, adminName, adminEmail, adminPassword, logoUrl, backendUrl } = req.body;

    const result = await provisionTenantDatabase({
      name,
      slug,
      adminName,
      adminEmail,
      adminPassword,
      logoUrl,
      backendUrl
    });

    return res.status(201).json({
      success: true,
      message: 'Dedicated database and company created successfully',
      data: result
    });
  } catch (err) {
    console.error('❌ Provision tenant error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// 4. Update Tenant Configuration (Company Name, Logo URL, Backend API, Subdomain)
async function updateTenant(req, res) {
  try {
    const { id } = req.params;
    const { name, slug, logoUrl, backendUrl, subdomain, status, adminName, adminEmail } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    if (name !== undefined) tenant.name = name;
    if (slug !== undefined) tenant.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (logoUrl !== undefined) tenant.logo_url = logoUrl;
    if (backendUrl !== undefined) tenant.backend_url = backendUrl;
    if (subdomain !== undefined) tenant.subdomain = subdomain;
    if (status !== undefined) tenant.status = status;
    if (adminName !== undefined) tenant.admin_name = adminName;
    if (adminEmail !== undefined) tenant.admin_email = adminEmail;

    await tenant.save();

    // Optionally sync into tenant DB's CompanySetting table
    try {
      const tenantDb = getTenantDb(tenant.db_name);
      if (tenantDb && tenantDb.models && tenantDb.models.CompanySetting) {
        const [setting] = await tenantDb.models.CompanySetting.findOrCreate({
          where: { id: 1 },
          defaults: { companyName: tenant.name, logoUrl: tenant.logo_url }
        });
        if (setting) {
          if (name !== undefined) setting.companyName = tenant.name;
          if (logoUrl !== undefined) setting.logoUrl = tenant.logo_url;
          await setting.save();
        }
      }
    } catch (e) {
      console.warn('⚠️ Warning: CompanySetting sync to tenant DB failed:', e.message);
    }

    return res.json({
      success: true,
      message: 'Company configuration updated successfully',
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logo_url,
        backendUrl: tenant.backend_url,
        db_name: tenant.db_name,
        subdomain: tenant.subdomain,
        adminName: tenant.admin_name,
        adminEmail: tenant.admin_email,
        status: tenant.status
      }
    });
  } catch (err) {
    console.error('❌ Update tenant error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update tenant configuration', error: err.message });
  }
}

// 5. Toggle Tenant Status (ACTIVE / SUSPENDED)
async function toggleTenantStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const nextStatus = status || (tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
    tenant.status = nextStatus;
    await tenant.save();

    return res.json({
      success: true,
      message: `Tenant status updated to ${nextStatus}`,
      data: tenant
    });
  } catch (err) {
    console.error('❌ Update tenant status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update tenant status' });
  }
}

// 6. Request Security OTP to Drop Database
async function requestDeleteTenantOtp(req, res) {
  try {
    await initMasterDatabase();
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant company not found' });
    }

    if (tenant.slug === 'gluckscare' || tenant.db_name === 'gluckscare_db' || tenant.db_name === 'gluckscare_master_db') {
      return res.status(403).json({
        success: false,
        message: 'Action prohibited: The primary flagship instance database cannot be deleted.'
      });
    }

    const requestedBy = req.platformAdmin ? (req.platformAdmin.username || req.platformAdmin.email || 'Super Admin') : 'Master Admin';

    const result = await generateAndSendDeleteOtp({
      tenantId: tenant.id,
      tenantName: tenant.name,
      dbName: tenant.db_name,
      slug: tenant.slug,
      requestedBy
    });

    return res.json(result);
  } catch (err) {
    console.error('❌ Request delete OTP error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// 7. Secure Delete Tenant & Drop Physical Database (Requires Verified OTP + Confirmation)
async function deleteTenant(req, res) {
  try {
    await initMasterDatabase();
    const { id } = req.params;
    const otp = req.body?.otp || req.headers['x-delete-otp'] || req.query?.otp;
    const confirmDbName = req.body?.confirmDbName || req.headers['x-confirm-db-name'] || req.query?.confirmDbName;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant company not found' });
    }

    if (tenant.slug === 'gluckscare' || tenant.db_name === 'gluckscare_db' || tenant.db_name === 'gluckscare_master_db') {
      return res.status(403).json({
        success: false,
        message: 'Action prohibited: The primary flagship instance database cannot be deleted.'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'Security authorization required: Please request an OTP and enter the 6-digit code to drop this database.'
      });
    }

    // Verify OTP and exact DB name
    verifyDeleteOtp({
      tenantId: tenant.id,
      inputOtp: otp,
      confirmDbName,
      actualDbName: tenant.db_name
    });

    // If OTP is verified, proceed with physical database drop and tenant removal
    const result = await dropTenantDatabase(id);
    return res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('❌ Delete tenant error:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
}

// 7. PUBLIC APP API: Get Company Config for Mobile / Web App (by slug, subdomain, or id)
async function getCompanyConfig(req, res) {
  try {
    await initMasterDatabase();
    const identifier = (req.params.identifier || req.query.slug || req.query.code || '').trim();

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Company identifier (slug, code, or subdomain) is required'
      });
    }

    const cleanIdentifier = identifier.toLowerCase();

    // Check by slug, subdomain, id, or db_name
    const tenant = await Tenant.findOne({
      where: {
        [Op.or]: [
          { slug: cleanIdentifier },
          { subdomain: cleanIdentifier },
          { subdomain: `${cleanIdentifier}.gluckscare.com` },
          ...(cleanIdentifier.includes('-') && cleanIdentifier.length > 20 ? [{ id: cleanIdentifier }] : [])
        ]
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: `Company with identifier "${identifier}" not found`
      });
    }

    const defaultApiUrl = process.env.PUBLIC_API_URL || 'https://api.gluckscare.com';

    return res.json({
      success: true,
      data: {
        id: tenant.id,
        companyName: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logo_url || null,
        backendUrl: tenant.backend_url || defaultApiUrl,
        subdomain: tenant.subdomain,
        status: tenant.status
      }
    });
  } catch (err) {
    console.error('❌ Get company config error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve company configuration',
      error: err.message
    });
  }
}

// 8. PUBLIC APP API: List Active Companies for Mobile / Web App Selection
async function getPublicCompanies(req, res) {
  try {
    await initMasterDatabase();

    const tenants = await Tenant.findAll({
      where: { status: 'ACTIVE' },
      attributes: ['id', 'name', 'slug', 'logo_url', 'backend_url', 'subdomain', 'status'],
      order: [['name', 'ASC']]
    });

    const defaultApiUrl = process.env.PUBLIC_API_URL || 'https://api.gluckscare.com';

    const formatted = tenants.map(t => ({
      id: t.id,
      companyName: t.name,
      slug: t.slug,
      logoUrl: t.logo_url || null,
      backendUrl: t.backend_url || defaultApiUrl,
      subdomain: t.subdomain,
      status: t.status
    }));

    return res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (err) {
    console.error('❌ Get public companies error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public companies',
      error: err.message
    });
  }
}

// 7. Get Centralized Pricing Configuration
async function getPricingConfig(req, res) {
  try {
    const config = await getActivePricingConfig();
    return res.json({
      success: true,
      data: config
    });
  } catch (err) {
    console.error('❌ Get pricing config error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve pricing configuration',
      error: err.message
    });
  }
}

// 8. Update Centralized Pricing Configuration
async function updatePricingConfig(req, res) {
  try {
    const newConfig = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid pricing configuration payload' });
    }

    let setting = await PlatformSetting.findByPk('pricing_config');
    if (!setting) {
      setting = await PlatformSetting.create({
        key: 'pricing_config',
        value: { ...DEFAULT_PRICING_CONFIG, ...newConfig }
      });
    } else {
      await setting.update({
        value: { ...setting.value, ...newConfig }
      });
    }

    return res.json({
      success: true,
      message: 'Pricing configuration updated successfully',
      data: setting.value
    });
  } catch (err) {
    console.error('❌ Update pricing config error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update pricing configuration',
      error: err.message
    });
  }
}

// 9. Calculate Dynamic Subscription Pricing (Validated on backend)
async function calculatePricing(req, res) {
  try {
    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const rawUsers = payload.users || payload.userCount || payload.user_count || 10;
    const isFirstTime = payload.isFirstTime !== undefined
      ? (payload.isFirstTime === true || payload.isFirstTime === 'true' || payload.isFirstTime === 1)
      : true;
    const config = await getActivePricingConfig();
    const result = calculateSubscriptionPrice(config, rawUsers, rawCycle, { isFirstTime });

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('❌ Calculate pricing error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate subscription pricing',
      error: err.message
    });
  }
}

// 10. Get PayU Configuration
async function getPayUConfig(req, res) {
  try {
    const config = await getActivePayuConfig();
    return res.json({
      success: true,
      data: {
        key: config.key,
        client_id: config.client_id,
        mode: config.mode,
        enabled: config.enabled,
        hasSalt: !!config.salt,
        hasClientSecret: !!config.client_secret,
        // Provide masked preview for security
        saltMasked: config.salt ? `${config.salt.substring(0, 4)}••••${config.salt.slice(-4)}` : '',
        secretMasked: config.client_secret ? `${config.client_secret.substring(0, 6)}••••${config.client_secret.slice(-6)}` : ''
      }
    });
  } catch (err) {
    console.error('❌ Get PayU config error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve PayU configuration',
      error: err.message
    });
  }
}

// 11. Update PayU Configuration
async function updatePayUConfig(req, res) {
  try {
    const { key, salt, client_id, client_secret, mode, enabled } = req.body;
    let setting = await PlatformSetting.findByPk('payu_config');
    const existing = setting ? setting.value : DEFAULT_PAYU_CONFIG;

    const updated = {
      key: key !== undefined ? normalizePayuKey(key) : existing.key,
      salt: salt && !salt.includes('••••') ? normalizePayuSalt(salt) : existing.salt,
      client_id: client_id !== undefined ? String(client_id).trim() : existing.client_id,
      client_secret: client_secret && !client_secret.includes('••••') ? String(client_secret).trim() : existing.client_secret,
      mode: mode || existing.mode || 'LIVE',
      enabled: enabled !== undefined ? !!enabled : existing.enabled
    };

    if (!setting) {
      setting = await PlatformSetting.create({ key: 'payu_config', value: updated });
    } else {
      await setting.update({ value: updated });
    }

    return res.json({
      success: true,
      message: 'PayU gateway configuration saved successfully',
      data: {
        key: updated.key,
        client_id: updated.client_id,
        mode: updated.mode,
        enabled: updated.enabled
      }
    });
  } catch (err) {
    console.error('❌ Update PayU config error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update PayU configuration',
      error: err.message
    });
  }
}

// 12. Get Tenant Subscription Details
async function getTenantSubscription(req, res) {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    return res.json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscription_plan,
        subscriptionCategory: tenant.subscription_category, // 'PAID_SAAS' vs 'EXEMPT_NO_PAY'
        billingCycle: tenant.billing_cycle,
        licensedUsers: tenant.licensed_users,
        ratePerUser: tenant.rate_per_user,
        subscriptionStatus: tenant.subscription_status,
        subscriptionStartDate: tenant.subscription_start_date,
        subscriptionEndDate: tenant.subscription_end_date,
        paymentGateway: tenant.payment_gateway,
        lastPaymentId: tenant.last_payment_id,
        lastPaymentAmount: tenant.last_payment_amount
      }
    });
  } catch (err) {
    console.error('❌ Get tenant subscription error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant subscription',
      error: err.message
    });
  }
}

// 13. Update Tenant Subscription (Category toggle, user quota, plan change)
async function updateTenantSubscription(req, res) {
  try {
    const { id } = req.params;
    const {
      subscriptionPlan,
      subscriptionCategory, // 'PAID_SAAS' or 'EXEMPT_NO_PAY' (bina pay ke change wali)
      billingCycle,
      licensedUsers,
      ratePerUser,
      subscriptionStatus,
      subscriptionEndDate,
      paymentGateway
    } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const updates = {};
    if (subscriptionPlan !== undefined) updates.subscription_plan = subscriptionPlan;
    if (subscriptionCategory !== undefined) updates.subscription_category = subscriptionCategory;
    if (billingCycle !== undefined) updates.billing_cycle = billingCycle;
    if (licensedUsers !== undefined) updates.licensed_users = parseInt(licensedUsers, 10);
    if (ratePerUser !== undefined) updates.rate_per_user = parseFloat(ratePerUser);
    if (subscriptionStatus !== undefined) updates.subscription_status = subscriptionStatus;
    if (subscriptionEndDate !== undefined) updates.subscription_end_date = subscriptionEndDate;
    if (paymentGateway !== undefined) updates.payment_gateway = paymentGateway;

    // If switched to EXEMPT_NO_PAY, automatically set payment gateway to EXEMPT
    if (subscriptionCategory === 'EXEMPT_NO_PAY') {
      updates.payment_gateway = 'EXEMPT';
      if (!updates.rate_per_user && updates.rate_per_user !== 0) {
        updates.rate_per_user = 0;
      }
    }

    await tenant.update(updates);

    return res.json({
      success: true,
      message: `Tenant subscription updated successfully (${updates.subscription_category || tenant.subscription_category})`,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subscriptionPlan: tenant.subscription_plan,
        subscriptionCategory: tenant.subscription_category,
        billingCycle: tenant.billing_cycle,
        licensedUsers: tenant.licensed_users,
        ratePerUser: tenant.rate_per_user,
        subscriptionStatus: tenant.subscription_status,
        subscriptionEndDate: tenant.subscription_end_date,
        paymentGateway: tenant.payment_gateway
      }
    });
  } catch (err) {
    console.error('❌ Update tenant subscription error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update tenant subscription',
      error: err.message
    });
  }
}

// 14. Initiate PayU Checkout Session
async function initiatePayUCheckout(req, res) {
  try {
    const {
      tenantId,
      userCount = 10,
      billingCycle = 'annual',
      planName = 'Professional Growth',
      returnUrl,
      cancelUrl
    } = req.body;

    let targetTenant = null;
    if (tenantId) {
      targetTenant = await Tenant.findByPk(tenantId);
    }

    // Check if target tenant is EXEMPT_NO_PAY
    if (targetTenant && targetTenant.subscription_category === 'EXEMPT_NO_PAY') {
      return res.status(400).json({
        success: false,
        message: 'This tenant belongs to the Complimentary / Internal category and is exempt from payment gateways.'
      });
    }

    // Dynamic price calculation
    const pricingConfig = await getActivePricingConfig();
    const isFirstTime = req.body.isFirstTime !== undefined
      ? (req.body.isFirstTime === true || req.body.isFirstTime === 'true' || req.body.isFirstTime === 1)
      : (!targetTenant || targetTenant.subscription_status === 'PROSPECT' || !targetTenant.last_payment_id);
    const priceCalculation = calculateSubscriptionPrice(pricingConfig, userCount, billingCycle, { isFirstTime });

    if (priceCalculation.isEnterprise) {
      return res.status(400).json({
        success: false,
        message: 'Fleet sizes of 1,001+ require custom contract agreements. Please contact enterprise sales.'
      });
    }

    const productinfo = priceCalculation.setupFee > 0
      ? `SaaS Subscription: ${planName} (${userCount} Users - ${billingCycle}) + One-Time Setup Fee`
      : `SaaS Subscription: ${planName} (${userCount} Users - ${billingCycle})`;

    const payuPayload = await initiatePayUPayment({
      tenantId: targetTenant ? targetTenant.id : 'NEW_PROSPECT',
      tenantSlug: targetTenant ? targetTenant.slug : 'new',
      companyName: targetTenant ? targetTenant.name : (req.body.companyName || 'Pharma Subscriber'),
      adminName: targetTenant ? targetTenant.admin_name : req.body.adminName,
      adminEmail: targetTenant ? targetTenant.admin_email : req.body.adminEmail,
      adminPhone: req.body.adminPhone || '9999999999',
      planName,
      productinfo,
      userCount: priceCalculation.userCount,
      billingCycle,
      amount: priceCalculation.totalAmount,
      returnUrl: returnUrl || `${req.headers.origin || 'http://localhost:5173'}/payment/callback`,
      cancelUrl: cancelUrl || `${req.headers.origin || 'http://localhost:5173'}/payment/cancel`
    });

    return res.json({
      success: true,
      calculation: priceCalculation,
      payment: payuPayload
    });
  } catch (err) {
    console.error('❌ Initiate PayU checkout error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate PayU payment session',
      error: err.message
    });
  }
}

// 15. Handle PayU Return Webhook / Verification
async function handlePayUResponse(req, res) {
  try {
    const payuConfig = await getActivePayuConfig();
    const data = req.body || {};
    const isValid = verifyPaymentHash(data, payuConfig.salt);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'PayU SHA-512 signature verification failed. Potential tampering detected.'
      });
    }

    const { status, txnid, amount, udf1: tenantId, udf4: users, udf5: cycle } = data;

    if (status === 'success' && tenantId && tenantId !== 'NEW_PROSPECT') {
      const tenant = await Tenant.findByPk(tenantId);
      if (tenant) {
        const months = cycle === 'annual' ? 12 : (cycle === 'half_yearly' ? 6 : (cycle === 'quarterly' ? 3 : 1));
        const newEndDate = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);

        await tenant.update({
          subscription_status: 'ACTIVE',
          subscription_category: 'PAID_SAAS',
          billing_cycle: cycle || 'annual',
          licensed_users: parseInt(users, 10) || tenant.licensed_users,
          subscription_end_date: newEndDate,
          payment_gateway: 'PAYU',
          last_payment_id: txnid,
          last_payment_amount: parseFloat(amount)
        });
        console.log(`✅ Activated PayU subscription for tenant: ${tenant.name} (${txnid})`);
      }
    }

    return res.json({
      success: true,
      status,
      txnid,
      verified: true
    });
  } catch (err) {
    console.error('❌ Handle PayU response error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process PayU callback',
      error: err.message
    });
  }
}

// 16. Tenant Self-Service: Get Current Subscription (for Admin Profile & Settings)
async function getCurrentTenantSubscription(req, res) {
  try {
    // If tenant context is attached by authMiddleware
    let tenantRecord = null;
    if (req.tenant && req.tenant.id) {
      tenantRecord = await Tenant.findByPk(req.tenant.id);
    } else if (req.tenant && req.tenant.slug) {
      tenantRecord = await Tenant.findOne({ where: { slug: req.tenant.slug } });
    } else if (req.headers['x-tenant-slug']) {
      tenantRecord = await Tenant.findOne({ where: { slug: req.headers['x-tenant-slug'] } });
    } else {
      // Default fallback to main tenant (GlucksCare)
      tenantRecord = await Tenant.findOne({ where: { slug: 'gluckscare' } });
    }

    if (!tenantRecord) {
      // Return default complimentary representation
      return res.json({
        success: true,
        data: {
          name: 'GlucksCare ERP',
          subscriptionPlan: 'Enterprise Flagship',
          subscriptionCategory: 'EXEMPT_NO_PAY',
          billingCycle: 'annual',
          licensedUsers: 9999,
          activeUsers: 1,
          subscriptionStatus: 'ACTIVE',
          isExempt: true,
          renewalDate: null,
          paymentGateway: 'EXEMPT'
        }
      });
    }

    let realActiveUsers = tenantRecord.active_users || 1;
    try {
      const tenantDb = getTenantDb(tenantRecord.db_name);
      if (tenantDb && tenantDb.models && tenantDb.models.User) {
        realActiveUsers = await tenantDb.models.User.count({ where: { is_active: true } }).catch(() => realActiveUsers);
      }
    } catch (e) {}

    return res.json({
      success: true,
      data: {
        id: tenantRecord.id,
        name: tenantRecord.name,
        slug: tenantRecord.slug,
        subscriptionPlan: tenantRecord.subscription_plan || 'Starter',
        subscriptionCategory: tenantRecord.subscription_category || (tenantRecord.slug === 'gluckscare' ? 'EXEMPT_NO_PAY' : 'PAID_SAAS'),
        isExempt: tenantRecord.subscription_category === 'EXEMPT_NO_PAY',
        billingCycle: tenantRecord.billing_cycle || 'annual',
        licensedUsers: tenantRecord.licensed_users || 25,
        activeUsers: realActiveUsers,
        ratePerUser: tenantRecord.rate_per_user || 200,
        subscriptionStatus: tenantRecord.subscription_status || 'ACTIVE',
        subscriptionStartDate: tenantRecord.subscription_start_date,
        subscriptionEndDate: tenantRecord.subscription_end_date,
        paymentGateway: tenantRecord.payment_gateway || 'PAYU',
        lastPaymentId: tenantRecord.last_payment_id,
        lastPaymentAmount: tenantRecord.last_payment_amount
      }
    });
  } catch (err) {
    console.error('❌ Get current tenant subscription error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current subscription status',
      error: err.message
    });
  }
}

module.exports = {
  login,
  getTenants,
  createTenant,
  updateTenant,
  toggleTenantStatus,
  requestDeleteTenantOtp,
  deleteTenant,
  getCompanyConfig,
  getPublicCompanies,
  getPricingConfig,
  updatePricingConfig,
  calculatePricing,
  getPayUConfig,
  updatePayUConfig,
  getTenantSubscription,
  updateTenantSubscription,
  initiatePayUCheckout,
  handlePayUResponse,
  getCurrentTenantSubscription
};
