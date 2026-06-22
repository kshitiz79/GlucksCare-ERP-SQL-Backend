const { sequelize } = require('../src/config/database');

async function inspect() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    
    // Query list of constraints on the areas table
    const [results] = await sequelize.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as condef
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'areas';
    `);
    console.log('Constraints on areas table:', results);

    // Query list of indexes on the areas table
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'areas';
    `);
    console.log('Indexes on areas table:', indexes);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

inspect();
