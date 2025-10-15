// Sql-Backend/src/version/versionCleanupScheduler.js
const cron = require('node-cron');
const { scheduledVersionCleanup } = require('./versionController');

// Schedule cleanup to run daily at 2:00 AM
const scheduleVersionCleanup = () => {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled version cleanup...');
    try {
      const result = await scheduledVersionCleanup();
      if (result.success) {
        console.log(`✅ Scheduled cleanup completed successfully. Deleted ${result.deletedCount} records.`);
      } else {
        console.error('❌ Scheduled cleanup failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Scheduled cleanup error:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });

  console.log('📅 Version cleanup scheduler initialized - runs daily at 2:00 AM');
};

// Alternative: Run cleanup every 6 hours
const scheduleFrequentCleanup = () => {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running frequent version cleanup...');
    try {
      const result = await scheduledVersionCleanup();
      if (result.success) {
        console.log(`✅ Frequent cleanup completed. Deleted ${result.deletedCount} records.`);
      } else {
        console.error('❌ Frequent cleanup failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Frequent cleanup error:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('📅 Frequent version cleanup scheduler initialized - runs every 6 hours');
};

// Manual trigger for testing
const triggerManualCleanup = async () => {
  console.log('🔧 Triggering manual cleanup...');
  try {
    const result = await scheduledVersionCleanup();
    console.log('Manual cleanup result:', result);
    return result;
  } catch (error) {
    console.error('Manual cleanup error:', error);
    throw error;
  }
};

module.exports = {
  scheduleVersionCleanup,
  scheduleFrequentCleanup,
  triggerManualCleanup
};