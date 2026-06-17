const { sequelize } = require('../src/config/database');

async function inspect() {
  try {
    const columns = await sequelize.getQueryInterface().describeTable('inventory_items');
    console.log('Columns in inventory_items:', Object.keys(columns));
    console.log('Full structure:', columns);
  } catch (error) {
    console.error('Error describing table:', error);
  } finally {
    await sequelize.close();
  }
}

inspect();
