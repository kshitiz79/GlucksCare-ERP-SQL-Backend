// test-cleanup.js - Test script for location cleanup functionality

const { sequelize, ...models } = require('./src/config/database');
const LocationCleanupService = require('./src/utils/locationCleanupService');

async function testCleanup() {
  try {
    console.log('🧪 Testing Location Cleanup Service...\n');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Initialize cleanup service
    const cleanupService = new LocationCleanupService(models, sequelize);

    // Test 1: Check current status
    console.log('\nTest 1: Checking service status...');
    console.log('Status:', cleanupService.getStatus());

    // Test 2: Run manual cleanup
    console.log('\nTest 2: Running manual cleanup...');
    const result = await cleanupService.runManualCleanup();
    console.log('Cleanup result:', result);

    // Test 3: Check how many location records exist
    console.log('\nTest 3: Checking current location data...');
    const { Location, LocationEvent } = models;

    const locationCount = await Location.count();
    const eventCount = await LocationEvent.count();

    console.log(`Current data: ${locationCount} locations, ${eventCount} events`);

    // Test 4: Show data older than 24 hours
    const { Op } = sequelize.Sequelize;
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24);

    const oldLocationCount = await Location.count({
      where: {
        timestamp: {
          [Op.lt]: cutoffTime
        }
      }
    });

    const oldEventCount = await LocationEvent.count({
      where: {
        timestamp: {
          [Op.lt]: cutoffTime
        }
      }
    });

    console.log(`Old data (>24h): ${oldLocationCount} locations, ${oldEventCount} events`);

    console.log('\n✅ Cleanup test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

testCleanup();