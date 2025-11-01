// src/utils/locationCleanupService.js

class LocationCleanupService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
    this.isRunning = false;
    this.intervalId = null;
    this.cleanupIntervalHours = 1; // Run cleanup every hour
    this.dataRetentionHours = 24; // Keep data for 24 hours
  }

  // Delete location data older than specified hours
  async cleanupOldLocationData() {
    try {
      const { Location, LocationEvent } = this.models;
      const { Op } = this.sequelize.Sequelize;

      // Calculate cutoff time (24 hours ago)
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.dataRetentionHours);

      console.log(`🧹 Starting location data cleanup for data older than: ${cutoffTime.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}`);

      // Delete old location records
      const deletedLocations = await Location.destroy({
        where: {
          timestamp: {
            [Op.lt]: cutoffTime
          }
        }
      });

      // Delete old location events
      const deletedEvents = await LocationEvent.destroy({
        where: {
          timestamp: {
            [Op.lt]: cutoffTime
          }
        }
      });

      const totalDeleted = deletedLocations + deletedEvents;

      if (totalDeleted > 0) {
        console.log(`✅ Cleanup completed: Deleted ${deletedLocations} location records and ${deletedEvents} location events (Total: ${totalDeleted})`);
      } else {
        console.log(`✅ Cleanup completed: No old data found to delete`);
      }

      return {
        success: true,
        deletedLocations,
        deletedEvents,
        totalDeleted,
        cutoffTime: cutoffTime.toISOString()
      };

    } catch (error) {
      console.error('❌ Error during location data cleanup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Start automatic cleanup service
  startAutomaticCleanup() {
    if (this.isRunning) {
      console.log('Location cleanup service is already running');
      return;
    }

    console.log(`🚀 Starting automatic location cleanup service`);
    console.log(`📅 Data retention: ${this.dataRetentionHours} hours`);
    console.log(`⏰ Cleanup interval: ${this.cleanupIntervalHours} hour(s)`);

    // Run initial cleanup
    this.cleanupOldLocationData();

    // Set up recurring cleanup
    this.intervalId = setInterval(() => {
      this.cleanupOldLocationData();
    }, this.cleanupIntervalHours * 60 * 60 * 1000); // Convert hours to milliseconds

    this.isRunning = true;
    console.log('✅ Automatic location cleanup service started');
  }

  // Stop automatic cleanup service
  stopAutomaticCleanup() {
    if (!this.isRunning) {
      console.log('Location cleanup service is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('🛑 Automatic location cleanup service stopped');
  }

  // Manual cleanup trigger
  async runManualCleanup() {
    console.log('🔧 Running manual location data cleanup...');
    return await this.cleanupOldLocationData();
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      dataRetentionHours: this.dataRetentionHours,
      cleanupIntervalHours: this.cleanupIntervalHours,
      nextCleanupTime: this.isRunning ? 
        new Date(Date.now() + (this.cleanupIntervalHours * 60 * 60 * 1000)).toISOString() : 
        null
    };
  }

  // Update configuration
  updateConfig(retentionHours = 24, intervalHours = 1) {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stopAutomaticCleanup();
    }

    this.dataRetentionHours = retentionHours;
    this.cleanupIntervalHours = intervalHours;

    console.log(`⚙️ Updated cleanup configuration: retention=${retentionHours}h, interval=${intervalHours}h`);

    if (wasRunning) {
      this.startAutomaticCleanup();
    }
  }
}

module.exports = LocationCleanupService;