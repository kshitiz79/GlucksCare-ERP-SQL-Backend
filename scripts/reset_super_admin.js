// scripts/reset_super_admin.js
// Standalone utility script to reset / verify platform super admin credentials

const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { PlatformAdmin, initMasterDatabase, masterSequelize } = require('../src/platform/masterDb');

async function resetSuperAdmin() {
  console.log('🔄 Connecting to Master Database...');
  await initMasterDatabase();

  const adminsToEnsure = [
    {
      email: (process.env.SUPER_ADMIN_EMAIL || 'superadmin@gluckscare.com').toLowerCase().trim(),
      password: process.env.SUPER_ADMIN_PASSWORD || 'GlucksCare@2026',
      name: 'Platform Super Operator'
    },
    {
      email: 'superadmin@fieldomni.com',
      password: 'Fieldomni@2026',
      name: 'FieldOmni Super Operator'
    }
  ];

  for (const adm of adminsToEnsure) {
    const hashedPassword = await bcrypt.hash(adm.password, 10);
    const [record, created] = await PlatformAdmin.findOrCreate({
      where: { email: adm.email },
      defaults: {
        name: adm.name,
        email: adm.email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        is_active: true
      }
    });

    if (!created) {
      await record.update({
        password: hashedPassword,
        is_active: true,
        role: 'SUPER_ADMIN'
      });
      console.log(`✅ Updated existing Super Admin: ${adm.email} (Password: ${adm.password})`);
    } else {
      console.log(`✅ Created new Super Admin: ${adm.email} (Password: ${adm.password})`);
    }
  }

  const allAdmins = await PlatformAdmin.findAll({ attributes: ['id', 'email', 'name', 'role', 'is_active'] });
  console.log('\n📋 Active Platform Admins in Master DB:');
  allAdmins.forEach(a => {
    console.log(` - Email: ${a.email} | Role: ${a.role} | Active: ${a.is_active}`);
  });

  await masterSequelize.close();
  console.log('\n🎉 Finished successfully!');
  process.exit(0);
}

resetSuperAdmin().catch(err => {
  console.error('❌ Failed to reset Super Admin:', err);
  process.exit(1);
});

