const { sequelize } = require('../src/config/database');

async function run() {
  try {
    console.log('Starting migration to create areas table...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS areas (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        pincode VARCHAR(10) NOT NULL,
        post_office VARCHAR(255) NOT NULL,
        head_office_id UUID NOT NULL REFERENCES head_offices(id) ON DELETE CASCADE ON UPDATE CASCADE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_areas_head_office_id ON areas(head_office_id);
    `);

    console.log('Table areas created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
