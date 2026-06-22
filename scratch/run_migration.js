const { sequelize } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected successfully to database.');
    
    const sqlPath = path.join(__dirname, '../migrations/change_areas_pincode_uniqueness.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running migration:');
    console.log(sql);
    
    await sequelize.query(sql);
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

run();
