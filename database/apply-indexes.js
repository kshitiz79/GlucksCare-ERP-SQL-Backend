#!/usr/bin/env node

/**
 * Script to apply database indexes for performance optimization
 * Run with: node database/apply-indexes.js
 */

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyIndexes() {
  console.log('🔧 Starting database index creation...\n');

  // Create Sequelize connection
  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false
    }
  );

  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'indexes.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by semicolon and filter out comments and empty lines
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        // Extract index name for better logging
        const indexMatch = statement.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        const indexName = indexMatch ? indexMatch[1] : 'unknown';

        await sequelize.query(statement);
        console.log(`✅ Created index: ${indexName}`);
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⏭️  Skipped (already exists): ${statement.substring(0, 50)}...`);
          skipCount++;
        } else {
          console.error(`❌ Error: ${error.message}`);
          console.error(`   Statement: ${statement.substring(0, 100)}...`);
          errorCount++;
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    // Verify indexes
    console.log('\n🔍 Verifying indexes on users table...');
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users'
      ORDER BY indexname;
    `);

    console.log(`\nFound ${indexes.length} indexes on users table:`);
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    // Check locations table indexes
    console.log('\n🔍 Verifying indexes on locations table...');
    const [locationIndexes] = await sequelize.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'locations'
      ORDER BY indexname;
    `);

    console.log(`\nFound ${locationIndexes.length} indexes on locations table:`);
    locationIndexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    console.log('\n✅ Index creation completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your application');
    console.log('   2. Test the /api/users endpoint');
    console.log('   3. Check server logs for query timing');
    console.log('   4. Monitor performance improvements\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the script
applyIndexes().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
