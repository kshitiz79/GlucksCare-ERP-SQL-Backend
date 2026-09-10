// src/platform/tenantProvisioner.js
// Automated Physical Database Provisioning Engine for GlucksCare ERP

const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const { masterSequelize, Tenant } = require('./masterDb');
const { initTenantModels } = require('../config/modelFactory');
const { initializeDatabase } = require('../config/initDatabase');

async function provisionTenantDatabase({ name, slug, adminName, adminEmail, adminPassword }) {
  if (!name || !slug || !adminEmail || !adminPassword) {
    throw new Error('Company name, slug, admin email, and password are required');
  }

  // Format clean slug and DB name
  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  const dbName = `gluckscare_${cleanSlug.replace(/-/g, '_')}_db`;
  const subdomain = `${cleanSlug}.gluckscare.com`;

  // Check if tenant slug or db_name already exists in master registry
  const existingTenant = await Tenant.findOne({
    where: {
      [Sequelize.Op.or]: [{ slug: cleanSlug }, { db_name: dbName }]
    }
  });

  if (existingTenant) {
    throw new Error(`A company with slug "${cleanSlug}" or database "${dbName}" already exists`);
  }

  console.log(`🚀 [Provisioner] Step 1: Allocating PostgreSQL Database: "${dbName}"...`);
  // 1. Create physical PostgreSQL database
  try {
    // Note: Parameterized query is not supported for CREATE DATABASE in PostgreSQL
    await masterSequelize.query(`CREATE DATABASE "${dbName}";`);
  } catch (createErr) {
    // If database already exists on server, log warning but continue
    if (!createErr.message.includes('already exists')) {
      throw new Error(`Failed to create database "${dbName}": ${createErr.message}`);
    }
  }

  console.log(`🚀 [Provisioner] Step 2: Connecting to "${dbName}" and running table migrations...`);
  // 2. Connect to the newly created database
  const tenantSequelize = new Sequelize({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: dbName,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect: 'postgres',
    logging: false,
    pool: { max: 10, min: 0, idle: 10000 },
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  });

  // 3. Pre-create required extensions & sequences before model sync
  try {
    await tenantSequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await tenantSequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await tenantSequelize.query('CREATE SEQUENCE IF NOT EXISTS doctor_change_version_seq;');
  } catch (extErr) {
    console.warn('⚠️ Sequence/extension initialization note:', extErr.message);
  }

  // 4. Initialize all 50+ ERP models & sync schema
  const tenantModels = initTenantModels(tenantSequelize);
  await tenantSequelize.sync({ force: false });
  await initializeDatabase(tenantSequelize);

  console.log(`🚀 [Provisioner] Step 3: Seeding initial Company Admin (${adminEmail})...`);
  // 4. Seed initial Company Admin (password_hash is auto-hashed by User.beforeCreate hook)
  const empCode = 'ADM-' + Math.floor(100000 + Math.random() * 900000);
  await tenantModels.User.create({
    employee_code: empCode,
    name: adminName || `${name} Admin`,
    email: adminEmail.toLowerCase().trim(),
    password_hash: adminPassword,
    mobile_number: '9999999999',
    gender: 'Male',
    role: 'Admin',
    is_active: true,
    email_verified: true
  });

  // 5. Seed default Company Settings
  try {
    await tenantModels.CompanySetting.create({
      company_name: name,
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });
  } catch (csErr) {
    console.warn('⚠️ Warning: CompanySetting seeding skipped:', csErr.message);
  }

  // 6. Seed Indian States into new tenant database
  try {
    const defaultDb = require('../config/database');
    const existingStates = await defaultDb.sequelize.query(
      `SELECT name, code, country, is_active FROM states;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (existingStates && existingStates.length > 0) {
      await tenantModels.State.bulkCreate(existingStates, { ignoreDuplicates: true });
      console.log(`✅ Seeded ${existingStates.length} states in "${dbName}"`);
    }
  } catch (stateErr) {
    console.warn('⚠️ Warning: State seeding skipped:', stateErr.message);
  }

  console.log(`🚀 [Provisioner] Step 4: Registering tenant in Master Database...`);
  // 6. Record in Master DB
  const newTenant = await Tenant.create({
    name,
    slug: cleanSlug,
    db_name: dbName,
    subdomain,
    admin_name: adminName || `${name} Admin`,
    admin_email: adminEmail,
    status: 'ACTIVE',
    active_users: 1
  });

  // Close provisioning connection
  await tenantSequelize.close();

  console.log(`✅ [Provisioner] Database "${dbName}" successfully provisioned for ${name}!`);

  return {
    id: newTenant.id,
    name: newTenant.name,
    slug: newTenant.slug,
    db_name: newTenant.db_name,
    subdomain: newTenant.subdomain,
    adminName: newTenant.admin_name,
    adminEmail: newTenant.admin_email,
    adminPassword: adminPassword,
    status: newTenant.status,
    activeUsers: newTenant.active_users,
    createdAt: newTenant.created_at
  };
}

async function dropTenantDatabase(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const dbName = tenant.db_name;
  console.log(`⚠️ [Provisioner] Terminating active connections and dropping database "${dbName}"...`);

  try {
    // Terminate active connections to the tenant database before dropping
    await masterSequelize.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${dbName}' AND pid <> pg_backend_pid();
    `);

    // Drop physical database
    await masterSequelize.query(`DROP DATABASE IF EXISTS "${dbName}";`);
  } catch (err) {
    console.warn(`⚠️ Warning during drop database "${dbName}":`, err.message);
  }

  // Delete from Master DB
  await tenant.destroy();
  console.log(`✅ [Provisioner] Database "${dbName}" and tenant record deleted.`);
  return { success: true, message: `Database ${dbName} dropped successfully` };
}

module.exports = {
  provisionTenantDatabase,
  dropTenantDatabase
};
