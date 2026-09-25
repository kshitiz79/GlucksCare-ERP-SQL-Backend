// src/platform/platformController.js
// Controller for Platform Super Admin operations

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Tenant, PlatformAdmin, initMasterDatabase } = require('./masterDb');
const { provisionTenantDatabase, dropTenantDatabase } = require('./tenantProvisioner');
const { getTenantDb } = require('./tenantConnectionManager');

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

// 6. Delete Tenant & Drop Database
async function deleteTenant(req, res) {
  try {
    const { id } = req.params;
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

module.exports = {
  login,
  getTenants,
  createTenant,
  updateTenant,
  toggleTenantStatus,
  deleteTenant,
  getCompanyConfig,
  getPublicCompanies
};
