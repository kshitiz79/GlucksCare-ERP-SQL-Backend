const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const testDetailedConnection = async () => {
  console.log('Testing detailed database connection...');
  console.log('Host:', process.env.DB_HOST);
  console.log('Port:', process.env.DB_PORT);
  console.log('Database:', process.env.DB_NAME);
  console.log('User:', process.env.DB_USER);
  
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Direct connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version);
    
    // Check users table
    try {
      const userResult = await client.query('SELECT COUNT(*) as count FROM users');
      console.log(`Found ${userResult.rows[0].count} users in the database`);
    } catch (err) {
      console.log('Users table check failed:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error);
  } finally {
    try {
      await client.end();
    } catch (err) {
      console.error('Error closing connection:', err.message);
    }
  }
};

testDetailedConnection();