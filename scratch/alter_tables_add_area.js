const { sequelize } = require('../src/config/database');

async function run() {
  try {
    console.log('Starting alter tables migration for doctor, chemist, stockist...');

    await sequelize.query(`
      ALTER TABLE doctors ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    await sequelize.query(`
      ALTER TABLE chemists ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    await sequelize.query(`
      ALTER TABLE stockists ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_doctors_area_id ON doctors(area_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_chemists_area_id ON chemists(area_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_stockists_area_id ON stockists(area_id);
    `);

    console.log('Tables altered successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Alter migration failed:', error);
    process.exit(1);
  }
}

run();
