const { sequelize } = require('./src/config/database');

async function run() {
  try {
    console.log('Starting migration for expense_settings...');

    // Add effective_date column
    await sequelize.query(`
      ALTER TABLE expense_settings ADD COLUMN IF NOT EXISTS effective_date DATE;
    `);

    // Set default value for existing rows
    await sequelize.query(`
      UPDATE expense_settings SET effective_date = '2025-05-01' WHERE effective_date IS NULL;
    `);

    // Check if empty, and seed a default setting starting from 2000-01-01
    const [rows] = await sequelize.query("SELECT COUNT(*) FROM expense_settings;");
    const count = parseInt(rows[0].count || rows[0].COUNT, 10);
    if (count === 0) {
      console.log('Seeding default active setting starting from 2025-05-01...');
      const crypto = require('crypto');
      const id = crypto.randomUUID();
      await sequelize.query(`
        INSERT INTO expense_settings (id, rate_per_km, head_office_amount, outside_head_office_amount, effective_date, created_at, updated_at)
        VALUES ('${id}', 2.40, 150.00, 175.00, '2025-05-01', NOW(), NOW());
      `);
    }

    // Make it NOT NULL
    await sequelize.query(`
      ALTER TABLE expense_settings ALTER COLUMN effective_date SET NOT NULL;
    `);

    // Add unique constraint (if not already exists)
    await sequelize.query(`
      ALTER TABLE expense_settings DROP CONSTRAINT IF EXISTS uniq_expense_settings_effective_date;
      ALTER TABLE expense_settings ADD CONSTRAINT uniq_expense_settings_effective_date UNIQUE (effective_date);
    `);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
