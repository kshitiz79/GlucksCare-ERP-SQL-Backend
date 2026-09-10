// src/platform/platformController.js
// Controller for Platform Super Admin operations

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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
      { id: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('❌ Super Admin login error:', err);
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
      try {
        const tenantDb = getTenantDb(t.db_name);
        if (tenantDb && tenantDb.models && tenantDb.models.User) {
          realCount = await tenantDb.models.User.count({ where: { is_active: true } });
        }
      } catch (e) {
        // Fallback to recorded count
      }

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        db_name: t.db_name,
        subdomain: t.subdomain,
        adminName: t.admin_name,
        adminEmail: t.admin_email,
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
    const { name, slug, adminName, adminEmail, adminPassword } = req.body;

    const result = await provisionTenantDatabase({
      name,
      slug,
      adminName,
      adminEmail,
      adminPassword
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

// 4. Toggle Tenant Status (ACTIVE / SUSPENDED)
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

// 5. Delete Tenant & Drop Database
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

module.exports = {
  login,
  getTenants,
  createTenant,
  toggleTenantStatus,
  deleteTenant
};
