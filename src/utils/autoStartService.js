// src/utils/autoStartService.js

const AutoLocationSimulator = require('./autoLocationSimulator');
const LocationCleanupService = require('./locationCleanupService');

class AutoStartService {
  constructor() {
    this.simulator = null;
    this.cleanupService = null;
    this.isInitialized = false;
  }

  // Initialize and auto-start services
  async initialize(models, sequelize) {
    if (this.isInitialized) {
      console.log('Auto-start service already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing auto-start services...');

      // Initialize location simulator
      this.simulator = new AutoLocationSimulator();
      
      // Initialize cleanup service
      this.cleanupService = new LocationCleanupService(models, sequelize);

      // Start cleanup service immediately
      this.cleanupService.startAutomaticCleanup();

      // Wait a moment for database to be ready, then start location simulation
      setTimeout(async () => {
        try {
          console.log('🎯 Auto-starting location simulation...');
          await this.simulator.autoStartForActiveUsers();
          console.log('✅ Location simulation auto-started successfully');
        } catch (error) {
          console.error('❌ Failed to auto-start location simulation:', error.message);
        }
      }, 5000); // Wait 5 seconds after server start

      this.isInitialized = true;
      console.log('✅ Auto-start service initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize auto-start service:', error);
    }
  }

  // Get status of all services
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      simulator: this.simulator ? this.simulator.getStatus() : null,
      cleanup: this.cleanupService ? this.cleanupService.getStatus() : null
    };
  }

  // Stop all services
  stopAll() {
    console.log('🛑 Stopping all auto-start services...');
    
    if (this.simulator) {
      this.simulator.stopAll();
    }
    
    if (this.cleanupService) {
      this.cleanupService.stopAutomaticCleanup();
    }
    
    console.log('✅ All auto-start services stopped');
  }
}

// Create singleton instance
const autoStartService = new AutoStartService();

module.exports = autoStartService;