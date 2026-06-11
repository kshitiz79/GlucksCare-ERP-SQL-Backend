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
      UPDATE expense_settings SET effective_date = '2000-01-01' WHERE effective_date IS NULL;
    `);
    
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
