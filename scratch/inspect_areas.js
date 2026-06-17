const { sequelize, Area } = require('../src/config/database');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected successfully to database.');
    const areas = await Area.findAll({ raw: true });
    console.log('Areas in database:', areas.length);
    console.log(areas);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

run();
