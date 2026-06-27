const { sequelize } = require('../src/config/database');

async function run() {
  try {
    console.log("Adding ucpmp_annual_cap column to doctors table...");
    await sequelize.query(`
      ALTER TABLE doctors ADD COLUMN IF NOT EXISTS ucpmp_annual_cap DECIMAL(12, 2) DEFAULT 10000.00;
    `);
    console.log("Column added successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit();
  }
}

run();
