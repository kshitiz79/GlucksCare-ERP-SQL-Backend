// src/utils/mockLocationGenerator.js

class MockLocationGenerator {
  constructor() {
    this.isRunning = false;
    this.intervals = new Map(); // Store intervals for each user
    this.userLocations = new Map(); // Store current location for each user
    this.models = null;
    this.io = null;
  }

  // Initialize with models and socket.io instance
  initialize(models, io) {
    this.models = models;
    this.io = io;
  }

  // Generate random coordinates within a realistic range (Delhi, India area)
  generateRandomLocation(baseLocation = null) {
    // Default to Delhi area if no base location provided
    const baseLat = baseLocation?.latitude || 28.6139;
    const baseLng = baseLocation?.longitude || 77.2090;
    
    // Generate location within ~10km radius
    const latOffset = (Math.random() - 0.5) * 0.1; // ~11km
    const lngOffset = (Math.random() - 0.5) * 0.1; // ~11km
    
    return {
      latitude: parseFloat((baseLat + latOffset).toFixed(8)),
      longitude: parseFloat((baseLng + lngOffset).toFixed(8)),
      accuracy: Math.random() * 20 + 5, // 5-25 meters
      speed: Math.random() * 15, // 0-15 m/s (0-54 km/h)
      battery_level: Math.floor(Math.random() * 100) + 1, // 1-100%
      network_type: ['4G', '3G', 'WiFi'][Math.floor(Math.random() * 3)]
    };
  }

  // Start generating mock data for specified users
  startMockData(userIds = [1, 2, 3, 4, 5], intervalSeconds = 10) {
    if (this.isRunning) {
      console.log('Mock data generation is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🎯 Starting mock location data generation for users: ${userIds.join(', ')}`);
    console.log(`⏱️  Update interval: ${intervalSeconds} seconds`);

    userIds.forEach(userId => {
      // Initialize user location if not exists
      if (!this.userLocations.has(userId)) {
        this.userLocations.set(userId, this.generateRandomLocation());
      }

      // Create interval for this user
      const interval = setInterval(async () => {
        try {
          await this.generateLocationUpdate(userId);
        } catch (error) {
          console.error(`Error generating location for user ${userId}:`, error);
        }
      }, intervalSeconds * 1000);

      this.intervals.set(userId, interval);
    });
  }

  // Stop generating mock data
  stopMockData() {
    if (!this.isRunning) {
      console.log('Mock data generation is not running');
      return;
    }

    console.log('🛑 Stopping mock location data generation');
    
    // Clear all intervals
    this.intervals.forEach((interval, userId) => {
      clearInterval(interval);
      console.log(`Stopped mock data for user ${userId}`);
    });
    
    this.intervals.clear();
    this.isRunning = false;
  }

  // Generate and save a location update for a specific user
  async generateLocationUpdate(userId) {
    try {
      // Get current location or generate new one
      let currentLocation = this.userLocations.get(userId);
      if (!currentLocation) {
        currentLocation = this.generateRandomLocation();
      }

      // Generate new location near current location (simulate movement)
      const newLocation = this.generateRandomLocation(currentLocation);
      
      // Update stored location
      this.userLocations.set(userId, newLocation);

      // Prepare location data for database
      const locationData = {
        user_id: userId,
        device_id: `device_${userId}_mock`,
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        timestamp: new Date(),
        accuracy: newLocation.accuracy,
        speed: newLocation.speed,
        battery_level: newLocation.battery_level,
        network_type: newLocation.network_type
      };

      // Save to database if models are available
      if (this.models && this.models.Location) {
        const savedLocation = await this.models.Location.create(locationData);
        console.log(`📍 Generated location for user ${userId}: ${newLocation.latitude}, ${newLocation.longitude}`);

        // Emit real-time update via Socket.IO if available
        if (this.io) {
          this.io.to('admin-location-tracking').emit('user-location-update', {
            userId,
            ...locationData,
            id: savedLocation.id
          });
        }

        return savedLocation;
      } else {
        console.log(`📍 Mock location generated for user ${userId} (no database save): ${newLocation.latitude}, ${newLocation.longitude}`);
        return locationData;
      }
    } catch (error) {
      console.error(`Error generating location update for user ${userId}:`, error);
      throw error;
    }
  }

  // Send a single test location update
  async sendTestLocation(userId) {
    try {
      console.log(`🧪 Sending test location for user ${userId}`);
      return await this.generateLocationUpdate(userId);
    } catch (error) {
      console.error(`Error sending test location for user ${userId}:`, error);
      throw error;
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeUsers: Array.from(this.intervals.keys()),
      userCount: this.intervals.size,
      userLocations: Object.fromEntries(this.userLocations)
    };
  }

  // Set models and io after initialization (for dependency injection)
  setDependencies(models, io) {
    this.models = models;
    this.io = io;
  }
}

module.exports = MockLocationGenerator;