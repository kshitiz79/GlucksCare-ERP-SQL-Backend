// Sql-Backend/src/version/setupVersionCleanup.js
const { scheduleVersionCleanup, triggerManualCleanup } = require('./versionCleanupScheduler');

// Setup function to initialize version cleanup
const setupVersionCleanup = (options = {}) => {
  const {
    enableScheduler = true,
    runInitialCleanup = false,
    logLevel = 'info'
  } = options;

  console.log('🚀 Setting up version cleanup system...');

  // Enable automatic scheduled cleanup
  if (enableScheduler) {
    scheduleVersionCleanup();
  }

  // Run initial cleanup if requested
  if (runInitialCleanup) {
    console.log('🔧 Running initial cleanup...');
    setTimeout(async () => {
      try {
        const result = await triggerManualCleanup();
        console.log('✅ Initial cleanup completed:', result);
      } catch (error) {
        console.error('❌ Initial cleanup failed:', error);
      }
    }, 5000); // Wait 5 seconds after app start
  }

  console.log('✅ Version cleanup system initialized');
};

module.exports = {
  setupVersionCleanup
};