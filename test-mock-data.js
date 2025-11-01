// test-mock-data.js - Simple test script for mock data generator

const MockLocationGenerator = require('./src/utils/mockLocationGenerator');

async function testMockData() {
  console.log('🧪 Testing Mock Location Data Generator...\n');

  const generator = new MockLocationGenerator();

  // Test 1: Send a single test location
  console.log('Test 1: Sending single test location...');
  await generator.sendTestLocation(1);
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Start mock data for multiple users
  console.log('\nTest 2: Starting mock data generation for 3 users...');
  generator.startMockData([1, 2, 3], 5); // Update every 5 seconds

  // Let it run for 30 seconds
  console.log('Running for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Test 3: Stop mock data
  console.log('\nTest 3: Stopping mock data generation...');
  generator.stopMockData();

  console.log('\n✅ Test completed!');
  process.exit(0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

testMockData().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});