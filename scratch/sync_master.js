const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function syncAllToMaster() {
  const masterDbName = process.env.MASTER_DB_NAME || 'gluckscare_master_db';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbPort = process.env.DB_PORT || 5432;

  const masterSeq = new Sequelize(masterDbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  });

  await masterSeq.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await masterSeq.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  const Tenant = masterSeq.define('Tenant', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    db_name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    subdomain: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    admin_name: { type: DataTypes.STRING(255), allowNull: true },
    admin_email: { type: DataTypes.STRING(255), allowNull: false },
    status: { type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'TRIAL'), defaultValue: 'ACTIVE' },
    active_users: { type: DataTypes.INTEGER, defaultValue: 1 }
  }, { tableName: 'tenants', underscored: true, timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  const PlatformAdmin = masterSeq.define('PlatformAdmin', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'Super Admin' },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(50), defaultValue: 'SUPER_ADMIN' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'platform_admins', underscored: true, timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

  await Tenant.sync({ alter: true });
  await PlatformAdmin.sync({ alter: true });

  const [verifiedTenants] = await masterSeq.query('SELECT name, slug, db_name, admin_email, created_at FROM tenants;');
  console.log(`✅ Verified ${verifiedTenants.length} tenants in ${masterDbName}:`, verifiedTenants);
  process.exit(0);
}

syncAllToMaster().catch(err => {
  console.error('❌ Error syncing master:', err);
  process.exit(1);
});
