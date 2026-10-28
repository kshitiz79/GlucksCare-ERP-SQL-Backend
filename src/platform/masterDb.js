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
    max: parseInt(process.env.DB_POOL_MAX || '25', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    acquire: 60000,
    idle: 10000,
    evict: 1000
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
  logo_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  backend_url: {
    type: DataTypes.STRING(255),
    allowNull: true
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
  },
  subscription_plan: {
    type: DataTypes.STRING(100),
    defaultValue: 'Starter'
  },
  subscription_category: {
    type: DataTypes.STRING(50),
    defaultValue: 'PAID_SAAS' // 'PAID_SAAS', 'EXEMPT_NO_PAY'
  },
  billing_cycle: {
    type: DataTypes.STRING(50),
    defaultValue: 'annual'
  },
  licensed_users: {
    type: DataTypes.INTEGER,
    defaultValue: 25
  },
  rate_per_user: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 200.00
  },
  subscription_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'ACTIVE' // 'ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED'
  },
  subscription_start_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  subscription_end_date: {
    type: DataTypes.DATE,
    defaultValue: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  },
  payment_gateway: {
    type: DataTypes.STRING(50),
    defaultValue: 'PAYU'
  },
  last_payment_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  last_payment_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
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

// Platform Setting Model (Pricing Config, PayU Config, etc.)
const PlatformSetting = masterSequelize.define('PlatformSetting', {
  key: {
    type: DataTypes.STRING(100),
    primaryKey: true
  },
  value: {
    type: DataTypes.JSONB,
    allowNull: false
  }
}, {
  tableName: 'platform_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

const DEFAULT_PRICING_CONFIG = {
  currency: 'INR',
  minimum_users: 10,
  gst_rate: 18,
  billing_cycles: {
    monthly: {
      key: 'monthly',
      label: 'Monthly',
      rate: 249,
      months: 1,
      billingText: 'Billed monthly',
      savingsBadge: null
    },
    quarterly: {
      key: 'quarterly',
      label: 'Quarterly',
      rate: 229,
      months: 3,
      billingText: 'Billed every 3 months',
      savingsBadge: 'Save 8%'
    },
    half_yearly: {
      key: 'half_yearly',
      label: 'Half-Yearly',
      rate: 215,
      months: 6,
      billingText: 'Billed every 6 months',
      savingsBadge: 'Save 14%'
    },
    annual: {
      key: 'annual',
      label: 'Annual',
      rate: 200,
      months: 12,
      billingText: 'Billed annually',
      savingsBadge: 'Save 20% + Volume Tiers',
      isBestValue: true
    }
  },
  volume_tiers: [
    { min_users: 1, max_users: 25, rate: 200, label: 'Starter (1–25)' },
    { min_users: 26, max_users: 50, rate: 195, label: 'Growth (26–50)' },
    { min_users: 51, max_users: 100, rate: 190, label: 'Scale (51–100)' },
    { min_users: 101, max_users: 250, rate: 180, label: 'Expansion (101–250)' },
    { min_users: 251, max_users: 500, rate: 170, label: 'Fleet (251–500)' },
    { min_users: 501, max_users: 1000, rate: 160, label: 'Mega Fleet (501–1,000)' }
  ],
  enterprise_threshold: 1001
};

const DEFAULT_PAYU_CONFIG = {
  key: process.env.PAYU_KEY || '3C4QvH',
  salt: process.env.PAYU_SALT || 'KWuZ3yBp7bOucD2DHBWdrrEcabZjHzHU',
  client_id: process.env.PAYU_CLIENT_ID || '4eb8246cedbad8e0a24143d0896cc6813f1120548fe707b58696f1436b0d84c8',
  client_secret: process.env.PAYU_CLIENT_SECRET || '642c8dddff6280f59afec060432f1ed5e053272fae8e71a6dd2aba32d0080a46',
  mode: process.env.PAYU_MODE || 'LIVE', // 'TEST' or 'LIVE'
  enabled: true
};

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
        logo_url TEXT,
        backend_url VARCHAR(255),
        db_name VARCHAR(100) NOT NULL UNIQUE,
        subdomain VARCHAR(255) NOT NULL,
        admin_name VARCHAR(255),
        admin_email VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        active_users INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS backend_url VARCHAR(255);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(100) DEFAULT 'Starter';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_category VARCHAR(50) DEFAULT 'PAID_SAAS';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(50) DEFAULT 'annual';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS licensed_users INTEGER DEFAULT 25;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rate_per_user NUMERIC(10, 2) DEFAULT 200.00;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'ACTIVE';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year');
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT 'PAYU';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_id VARCHAR(100);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_amount NUMERIC(12, 2);

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

      CREATE TABLE IF NOT EXISTS platform_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Sync models
    await Tenant.sync({ alter: true });
    await PlatformAdmin.sync();
    await PlatformSetting.sync();

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

    // Seed default Pricing Configuration in platform_settings if not present
    const pricingSetting = await PlatformSetting.findByPk('pricing_config');
    if (!pricingSetting) {
      await PlatformSetting.create({
        key: 'pricing_config',
        value: DEFAULT_PRICING_CONFIG
      });
      console.log('✅ Seeded default Pharma Sales SaaS pricing configuration');
    }

    // Seed default PayU Configuration in platform_settings if not present
    const payuSetting = await PlatformSetting.findByPk('payu_config');
    if (!payuSetting) {
      await PlatformSetting.create({
        key: 'payu_config',
        value: DEFAULT_PAYU_CONFIG
      });
      console.log('✅ Seeded PayU Gateway credentials and configuration');
    }

    // Ensure GlucksCare flagship tenant has 'EXEMPT_NO_PAY' category (no payment required)
    const glucksTenant = await Tenant.findOne({
      where: {
        slug: 'gluckscare'
      }
    });

    if (glucksTenant) {
      if (glucksTenant.subscription_category !== 'EXEMPT_NO_PAY') {
        await glucksTenant.update({
          subscription_plan: 'GlucksCare Enterprise (Internal)',
          subscription_category: 'EXEMPT_NO_PAY',
          licensed_users: 9999,
          rate_per_user: 0,
          payment_gateway: 'EXEMPT',
          billing_cycle: 'annual',
          subscription_status: 'ACTIVE'
        });
        console.log('✅ Updated GlucksCare flagship tenant to EXEMPT_NO_PAY (No Payment Needed)');
      }
    } else {
      // Seed main tenant if no tenants exist
      const count = await Tenant.count();
      if (count === 0) {
        await Tenant.create({
          name: 'GlucksCare Pharmaceuticals (Main)',
          slug: 'gluckscare',
          logo_url: 'https://gluckscare.com/logo.png',
          backend_url: 'https://api.gluckscare.com',
          db_name: process.env.DB_NAME || 'gluckscare_erp_production',
          subdomain: 'gluckscare.gluckscare.com',
          admin_name: 'Main Administrator',
          admin_email: 'admin@gluckscare.com',
          status: 'ACTIVE',
          active_users: 1,
          subscription_plan: 'GlucksCare Enterprise (Internal)',
          subscription_category: 'EXEMPT_NO_PAY',
          licensed_users: 9999,
          rate_per_user: 0,
          payment_gateway: 'EXEMPT',
          billing_cycle: 'annual',
          subscription_status: 'ACTIVE'
        });
        console.log('✅ Seeded default main tenant in master registry with EXEMPT_NO_PAY');
      }
    }

    // Pre-warm and ensure sync schemas across all active tenants
    try {
      const activeTenants = await Tenant.findAll({ where: { status: 'ACTIVE' } });
      const { getTenantDb } = require('./tenantConnectionManager');
      for (const t of activeTenants) {
        try {
          getTenantDb(t.db_name);
        } catch (tErr) {
          console.warn(`[initMasterDatabase] Tenant schema pre-warm warning for ${t.db_name}:`, tErr.message);
        }
      }
    } catch (pwErr) {}

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Master Database:', error.message);
    return false;
  }
}

module.exports = {
  masterSequelize,
  Tenant,
  PlatformAdmin,
  PlatformSetting,
  DEFAULT_PRICING_CONFIG,
  DEFAULT_PAYU_CONFIG,
  initMasterDatabase
};
