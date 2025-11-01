// src/utils/mockLocationGenerator.js

const axios = require('axios');

class MockLocationGenerator {
  constructor(baseUrl = 'http://localhost:5051') {
    this.baseUrl = baseUrl;
    this.isRunning = false;
    this.intervals = new Map();
    
    // Sample coordinates around Delhi/NCR area
    this.sampleLocations = [
      { lat: 28.613939, lng: 77.209021, name: "Connaught Place" },
      { lat: 28.627981, lng: 77.216721, name: "India Gate" },
      { lat: 28.656159, lng: 77.240410, name: "Red Fort" },
      { lat: 28.644800, lng: 77.216721, name: "Jama Masjid" },
      { lat: 28.524200, lng: 77.185600, name: "Qutub Minar" },
      { lat: 28.566535, lng: 77.240410, name: "Lotus Temple" },
      { lat: 28.640429, lng: 77.194710, name: "Rajpath" },
      { lat: 28.635308, lng: 77.224960, name: "Humayun's Tomb" }
    ];
  }

  // Generate random coordinates within a small radius of a base location
  generateNearbyCoordinate(baseLocation, radiusKm = 0.5) {
    const earthRadius = 6371; // Earth's radius in km
    const radiusInDegrees = radiusKm / earthRadius * (180 / Math.PI);
    
    const randomAngle = Math.random() * 2 * Math.PI;
    const randomRadius = Math.random() * radiusInDegrees;
    
    const lat = baseLocation.lat + (randomRadius * Math.cos(randomAngle));
    const lng = baseLocation.lng + (randomRadius * Math.sin(randomAngle));
    
    return { lat, lng };
  }

  // Generate mock location data for a user
  generateLocationData(userId, deviceId = null) {
    const baseLocation = this.sampleLocations[userId % this.sampleLocations.length];
    const { lat, lng } = this.generateNearbyCoordinate(baseLocation);
    
    return {
      user_id: userId,
      device_id: deviceId || `device_${userId}`,
      event_type: 'location_update',
      latitude: lat,
      longitude: lng,
      timestamp: new Date().toISOString(),
      metadata: {
        accuracy: Math.floor(Math.random() * 20) + 5, // 5-25 meters
        battery_level: Math.floor(Math.random() * 100) + 1, // 1-100%
        network_type: ['4G', '5G', 'WiFi'][Math.floor(Math.random() * 3)],
        speed: Math.floor(Math.random() * 60) // 0-60 km/h
      }
    };
  }

  // Send location data to the API
  async sendLocationUpdate(locationData) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/location-events`, locationData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Location update sent for user ${locationData.user_id}:`, {
        lat: locationData.latitude.toFixed(6),
        lng: locationData.longitude.toFixed(6),
        timestamp: locationData.timestamp
      });
      
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to send location update for user ${locationData.user_id}:`, error.message);
      return null;
    }
  }

  // Start generating mock data for specific users
  startMockData(userIds = [1, 2, 3, 4, 5], intervalSeconds = 10) {
    if (this.isRunning) {
      console.log('Mock data generator is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting mock location data generator for users: ${userIds.join(', ')}`);
    console.log(`📍 Update interval: ${intervalSeconds} seconds`);

    userIds.forEach(userId => {
      const intervalId = setInterval(async () => {
        const locationData = this.generateLocationData(userId);
        await this.sendLocationUpdate(locationData);
      }, intervalSeconds * 1000);

      this.intervals.set(userId, intervalId);
    });

    console.log('✅ Mock data generator started successfully');
  }

  // Stop generating mock data
  stopMockData() {
    if (!this.isRunning) {
      console.log('Mock data generator is not running');
      return;
    }

    console.log('🛑 Stopping mock location data generator...');
    
    this.intervals.forEach((intervalId, userId) => {
      clearInterval(intervalId);
      console.log(`Stopped mock data for user ${userId}`);
    });

    this.intervals.clear();
    this.isRunning = false;
    console.log('✅ Mock data generator stopped');
  }

  // Get status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeUsers: Array.from(this.intervals.keys()),
      totalActiveUsers: this.intervals.size
    };
  }

  // Send a single location update for testing
  async sendTestLocation(userId = 1) {
    const locationData = this.generateLocationData(userId);
    console.log('🧪 Sending test location update:', locationData);
    return await this.sendLocationUpdate(locationData);
  }
}

module.exports = MockLocationGenerator;