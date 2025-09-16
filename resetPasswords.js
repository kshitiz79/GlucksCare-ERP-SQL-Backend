const { sequelize, User } = require('./src/config/database');
const bcrypt = require('bcryptjs');

const resetPasswords = async () => {
  try {
    // Test database connection
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Reset password for admin user
    console.log('\nResetting password for admin@gmail.com...');
    const adminUser = await User.findOne({ where: { email: 'admin@gmail.com' } });
    
    if (adminUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('123456', salt);
      
      await adminUser.update({
        password_hash: hashedPassword
      });
      
      console.log('✅ Admin password reset successfully');
    } else {
      console.log('❌ Admin user not found');
    }
    
    // Reset password for regular user
    console.log('\nResetting password for kshitizmaurya6@gmail.com...');
    const regularUser = await User.findOne({ where: { email: 'kshitizmaurya6@gmail.com' } });
    
    if (regularUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('123456', salt);
      
      await regularUser.update({
        password_hash: hashedPassword
      });
      
      console.log('✅ Regular user password reset successfully');
    } else {
      console.log('❌ Regular user not found');
    }
    
  } catch (error) {
    console.error('❌ Error resetting passwords:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    await sequelize.close();
  }
};

resetPasswords();