const { sequelize } = require('./src/config/database');

const testConnection = async () => {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const [results] = await sequelize.query('SELECT version()');
    console.log('PostgreSQL version:', results[0].version);
    
    // Check if users table exists
    const [tableResults] = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );
    
    if (tableResults.length > 0) {
      console.log('✅ Users table exists');
      
      // Count users
      const [userCount] = await sequelize.query('SELECT COUNT(*) as count FROM users');
      console.log(`Found ${userCount[0].count} users in the database`);
    } else {
      console.log('❌ Users table does not exist');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await sequelize.close();
  }
};

testConnection();