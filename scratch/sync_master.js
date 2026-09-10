const { Sequelize, DataTypes } = require('sequelize');

async function syncAllToMaster() {
  const masterSeq = new Sequelize('gluckscare_master_db', 'postgres', '123456', {
    host: 'localhost',
    dialect: 'postgres',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  });

  const fanboySeq = new Sequelize('gluckscare_fanboy_db', 'postgres', '123456', { host: 'localhost', dialect: 'postgres', logging: false });

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

  await Tenant.sync({ force: true });
  await PlatformAdmin.sync({ force: true });

  const [tenants] = await fanboySeq.query('SELECT * FROM tenants;');
  const [admins] = await fanboySeq.query('SELECT * FROM platform_admins;');

  for (const t of tenants) {
    await Tenant.create(t);
  }
  for (const a of admins) {
    await PlatformAdmin.create(a);
  }

  const [verifiedTenants] = await masterSeq.query('SELECT name, slug, db_name, admin_email, created_at FROM tenants;');
  console.log('✅ Synchronized ' + verifiedTenants.length + ' tenants into gluckscare_master_db:', verifiedTenants);
  process.exit(0);
}

syncAllToMaster();
