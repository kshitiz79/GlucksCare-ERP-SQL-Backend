const { sequelize, User } = require('./src/config/database');

const diagnoseAuth = async () => {
  try {
    // Test database connection
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Check if users table exists
    console.log('\nChecking users table...');
    const usersTableExists = await sequelize.getQueryInterface().showAllSchemas();
    console.log('Available schemas:', usersTableExists);
    
    // Try to find users
    console.log('\nLooking for existing users...');
    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'role', 'employee_code']
    });
    
    if (users.length > 0) {
      console.log(`Found ${users.length} users:`);
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - ${user.name}`);
      });
    } else {
      console.log('No users found in database');
    }
    
    // Check specific users
    console.log('\nChecking specific users...');
    const adminUser = await User.findOne({ where: { email: 'admin@gmail.com' } });
    const regularUser = await User.findOne({ where: { email: 'kshitizmaurya6@gmail.com' } });
    
    if (adminUser) {
      console.log('✅ Admin user found:', adminUser.email, adminUser.role);
    } else {
      console.log('❌ Admin user not found');
    }
    
    if (regularUser) {
      console.log('✅ Regular user found:', regularUser.email, regularUser.role);
    } else {
      console.log('❌ Regular user not found');
    }
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    await sequelize.close();
  }
};

diagnoseAuth();