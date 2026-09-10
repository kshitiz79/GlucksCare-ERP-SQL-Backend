// src/platform/masterDb.js
// Master Database connection & Tenant Registry for Platform Super Admin

const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const masterDbName = process.env.MASTER_DB_NAME || 'gluckscare_master_db';

const masterSequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: masterDbName,
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

// Master Tenant Model
const Tenant = masterSequelize.define('Tenant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  db_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  subdomain: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  admin_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  admin_email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'TRIAL'),
    defaultValue: 'ACTIVE'
  },
  active_users: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  }
}, {
  tableName: 'tenants'
});

// Platform Super Admin Model
const PlatformAdmin = masterSequelize.define('PlatformAdmin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'Super Admin'
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'SUPER_ADMIN'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'platform_admins'
});

async function initMasterDatabase() {
  try {
    await masterSequelize.authenticate();
    console.log('✅ Master Database connection established');

    // Bulletproof: Ensure tables exist via raw SQL
    await masterSequelize.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        db_name VARCHAR(100) NOT NULL UNIQUE,
        subdomain VARCHAR(255) NOT NULL,
        admin_name VARCHAR(255),
        admin_email VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        active_users INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL DEFAULT 'Super Admin',
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Sync Tenant & PlatformAdmin models in Master DB
    await Tenant.sync();
    await PlatformAdmin.sync();

    // Seed default Platform Super Admin if not present
    const defaultEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@gluckscare.com';
    const defaultPassword = process.env.SUPER_ADMIN_PASSWORD || 'GlucksCare@2026';

    const existingAdmin = await PlatformAdmin.findOne({ where: { email: defaultEmail } });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      await PlatformAdmin.create({
        name: 'Platform Super Operator',
        email: defaultEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        is_active: true
      });
      console.log(`✅ Default Super Admin seeded: ${defaultEmail}`);
    }

    // Seed main tenant if no tenants exist
    const count = await Tenant.count();
    if (count === 0) {
      await Tenant.create({
        name: 'GlucksCare Pharmaceuticals (Main)',
        slug: 'gluckscare',
        db_name: process.env.DB_NAME || 'gluckscare_erp_production',
        subdomain: 'gluckscare.gluckscare.com',
        admin_name: 'Main Administrator',
        admin_email: 'admin@gluckscare.com',
        status: 'ACTIVE',
        active_users: 1
      });
      console.log('✅ Seeded default main tenant in master registry');
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Master Database:', error.message);
    throw error;
  }
}

module.exports = {
  masterSequelize,
  Tenant,
  PlatformAdmin,
  initMasterDatabase
};
