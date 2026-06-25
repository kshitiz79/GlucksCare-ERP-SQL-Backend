const db = require('../src/config/database');

async function run() {
  try {
    const users = await db.User.findAll({
      attributes: ['id', 'name', 'email', 'role']
    });
    console.log('Registered Users:');
    users.forEach(u => {
      console.log(`- ${u.name} (${u.email}) [Role: ${u.role}]`);
    });
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
