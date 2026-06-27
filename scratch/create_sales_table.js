const { sequelize } = require('../src/config/database');

async function run() {
  try {
    console.log("Dropping old doctor_sales table if it exists...");
    await sequelize.query(`DROP TABLE IF EXISTS doctor_sales CASCADE;`);

    console.log("Creating unified sales table...");
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sales (
          id UUID PRIMARY KEY,
          doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
          chemist_id UUID REFERENCES chemists(id) ON DELETE CASCADE,
          amount DECIMAL(12, 2) NOT NULL,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          notes TEXT,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_target_exists CHECK (doctor_id IS NOT NULL OR chemist_id IS NOT NULL)
      );
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_doctor_id ON sales(doctor_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_chemist_id ON sales(chemist_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    `);
    console.log("sales table created successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit();
  }
}

run();
