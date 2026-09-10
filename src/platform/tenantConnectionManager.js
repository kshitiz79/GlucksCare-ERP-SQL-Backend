// src/platform/tenantConnectionManager.js
// Dynamic Multi-Tenant PostgreSQL Connection Pool Cache & Tenant Resolver

const { Sequelize } = require('sequelize');
const { Tenant, masterSequelize } = require('./masterDb');
const { initTenantModels } = require('../config/modelFactory');

// In-memory cache of active Sequelize instances and models per database
const tenantConnections = new Map();

function getTenantDb(dbName) {
  if (!dbName) {
    dbName = process.env.DB_NAME || process.env.MASTER_DB_NAME;
  }

  if (!dbName) {
    throw new Error('Database name is required and neither dbName nor DB_NAME in .env was provided.');
  }

  if (tenantConnections.has(dbName)) {
    return tenantConnections.get(dbName);
  }

  console.log(`🔌 [TenantConnectionManager] Establishing dynamic connection pool for DB: "${dbName}"`);

  const sequelizeInstance = new Sequelize({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: dbName,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  });

  const models = initTenantModels(sequelizeInstance);

  const connectionBundle = {
    sequelize: sequelizeInstance,
    models
  };

  tenantConnections.set(dbName, connectionBundle);
  return connectionBundle;
}

// 1. Resolve Tenant by Slug or Subdomain
async function resolveTenantBySlug(slug) {
  if (!slug) return null;
  const cleanSlug = slug.toLowerCase().trim();
  const tenant = await Tenant.findOne({ where: { slug: cleanSlug, status: 'ACTIVE' } });
  if (!tenant) return null;

  const db = getTenantDb(tenant.db_name);
  return { tenant, db };
}

// 2. Resolve Tenant by Email (checks Master DB admin_email, then active tenants)
async function resolveTenantByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const cleanEmail = email.toLowerCase().trim();

  // Check 1: Check admin_email in Master DB
  const tenantByAdmin = await Tenant.findOne({
    where: { admin_email: cleanEmail, status: 'ACTIVE' }
  });

  if (tenantByAdmin) {
    const db = getTenantDb(tenantByAdmin.db_name);
    return { tenant: tenantByAdmin, db };
  }

  // Check 2: Check all active registered tenants in Master DB
  const allTenants = await Tenant.findAll({ where: { status: 'ACTIVE' } });
  for (const tenant of allTenants) {
    try {
      const tenantDb = getTenantDb(tenant.db_name);
      const userExists = await tenantDb.models.User.findOne({
        where: { email: cleanEmail, is_active: true }
      });
      if (userExists) {
        return { tenant, db: tenantDb };
      }
    } catch (e) {
      // Ignore connection errors on single tenant check
    }
  }

  return null;
}

// 3. Resolve Tenant from HTTP Request
async function resolveTenantFromRequest(req) {
  if (!req || !req.headers) return null;

  // Check header
  const headerSlug = req.headers['x-tenant-slug'] || req.headers['x-tenant-id'];
  if (headerSlug) {
    const result = await resolveTenantBySlug(headerSlug);
    if (result) return result;
  }

  // Check Subdomain (e.g. fanboy.gluckscare.com -> fanboy)
  const host = req.headers.host || '';
  const parts = host.split('.');
  if (parts.length > 2 && parts[0] !== 'api' && parts[0] !== 'platform' && parts[0] !== 'www') {
    const subdomainSlug = parts[0];
    const result = await resolveTenantBySlug(subdomainSlug);
    if (result) return result;
  }

  return null;
}

module.exports = {
  getTenantDb,
  resolveTenantBySlug,
  resolveTenantByEmail,
  resolveTenantFromRequest
};
