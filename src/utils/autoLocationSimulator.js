// src/utils/autoLocationSimulator.js

const axios = require('axios');

class AutoLocationSimulator {
    constructor(baseUrl = 'https://test.gluckscare.com') {
        this.baseUrl = baseUrl;
        this.isRunning = false;
        this.intervals = new Map();
        this.activeUsers = new Set();

        // Sample coordinates around Delhi/NCR area with realistic movement patterns
        this.userRoutes = {
            1: [
                { lat: 28.613939, lng: 77.209021, name: "Connaught Place" },
                { lat: 28.627981, lng: 77.216721, name: "India Gate" },
                { lat: 28.656159, lng: 77.240410, name: "Red Fort" }
            ],
            2: [
                { lat: 28.644800, lng: 77.216721, name: "Jama Masjid" },
                { lat: 28.524200, lng: 77.185600, name: "Qutub Minar" },
                { lat: 28.566535, lng: 77.240410, name: "Lotus Temple" }
            ],
            3: [
                { lat: 28.640429, lng: 77.194710, name: "Rajpath" },
                { lat: 28.635308, lng: 77.224960, name: "Humayun's Tomb" },
                { lat: 28.613939, lng: 77.209021, name: "Connaught Place" }
            ],
            4: [
                { lat: 28.704060, lng: 77.102493, name: "Gurgaon Sector 29" },
                { lat: 28.459497, lng: 77.026634, name: "Gurgaon Cyber City" },
                { lat: 28.413523, lng: 77.041929, name: "DLF Phase 1" }
            ],
            5: [
                { lat: 28.574389, lng: 77.312407, name: "Noida Sector 18" },
                { lat: 28.535517, lng: 77.391029, name: "Noida Sector 62" },
                { lat: 28.568715, lng: 77.320910, name: "Noida City Centre" }
            ]
        };

        this.userPositions = {}; // Track current position index for each user
    }

    // Generate realistic movement between route points
    generateRealisticLocation(userId) {
        const routes = this.userRoutes[userId] || this.userRoutes[1];

        // Initialize position if not exists
        if (!this.userPositions[userId]) {
            this.userPositions[userId] = {
                routeIndex: 0,
                progress: 0 // 0 to 1, progress between current and next point
            };
        }

        const position = this.userPositions[userId];
        const currentPoint = routes[position.routeIndex];
        const nextPoint = routes[(position.routeIndex + 1) % routes.length];

        // Interpolate between current and next point
        const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * position.progress;
        const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * position.progress;

        // Add small random variation for realistic GPS noise
        const noise = 0.0001; // About 10 meters
        const finalLat = lat + (Math.random() - 0.5) * noise;
        const finalLng = lng + (Math.random() - 0.5) * noise;

        // Update progress
        position.progress += 0.05; // Move 5% closer to next point each update
        if (position.progress >= 1) {
            position.progress = 0;
            position.routeIndex = (position.routeIndex + 1) % routes.length;
        }

        return { lat: finalLat, lng: finalLng };
    }

    // Generate location data with current Indian time
    generateLocationData(userId, deviceId = null) {
        const { lat, lng } = this.generateRealisticLocation(userId);

        // Always use current Indian time
        const indianTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

        return {
            user_id: userId,
            device_id: deviceId || `device_${userId}`,
            event_type: 'location_update',
            latitude: lat,
            longitude: lng,
            timestamp: new Date(indianTime).toISOString(),
            metadata: {
                accuracy: Math.floor(Math.random() * 15) + 5, // 5-20 meters
                battery_level: Math.floor(Math.random() * 40) + 60, // 60-100%
                network_type: ['4G', '5G', 'WiFi'][Math.floor(Math.random() * 3)],
                speed: Math.floor(Math.random() * 40) + 10 // 10-50 km/h (realistic city speed)
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

            console.log(`📍 Location update sent for user ${locationData.user_id}:`, {
                lat: locationData.latitude.toFixed(6),
                lng: locationData.longitude.toFixed(6),
                time: new Date(locationData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
            });

            return response.data;
        } catch (error) {
            console.error(`❌ Failed to send location update for user ${locationData.user_id}:`, error.message);
            return null;
        }
    }

    // Auto-start simulation for a user
    startUserSimulation(userId, intervalSeconds = 15) {
        if (this.intervals.has(userId)) {
            console.log(`User ${userId} simulation already running`);
            return;
        }

        console.log(`🚀 Starting automatic location simulation for user ${userId}`);

        const intervalId = setInterval(async () => {
            const locationData = this.generateLocationData(userId);
            await this.sendLocationUpdate(locationData);
        }, intervalSeconds * 1000);

        this.intervals.set(userId, intervalId);
        this.activeUsers.add(userId);
        this.isRunning = true;
    }

    // Stop simulation for a user
    stopUserSimulation(userId) {
        const intervalId = this.intervals.get(userId);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(userId);
            this.activeUsers.delete(userId);
            console.log(`🛑 Stopped simulation for user ${userId}`);
        }

        if (this.intervals.size === 0) {
            this.isRunning = false;
        }
    }

    // Auto-detect users and start simulations
    async autoStartForActiveUsers() {
        try {
            // Get list of users from the API
            const response = await axios.get(`${this.baseUrl}/api/users`);

            if (response.data.success && response.data.data) {
                const users = response.data.data;
                const userIds = users.slice(0, 5).map(user => user.id); // Simulate first 5 users

                console.log(`🎯 Auto-starting location simulation for users: ${userIds.join(', ')}`);

                userIds.forEach(userId => {
                    this.startUserSimulation(userId, 15); // Update every 15 seconds
                });

                return userIds;
            }
        } catch (error) {
            console.error('❌ Failed to auto-start simulations:', error.message);
            return [];
        }
    }

    // Stop all simulations
    stopAll() {
        console.log('🛑 Stopping all location simulations...');

        this.intervals.forEach((intervalId, userId) => {
            clearInterval(intervalId);
            console.log(`Stopped simulation for user ${userId}`);
        });

        this.intervals.clear();
        this.activeUsers.clear();
        this.isRunning = false;
        console.log('✅ All simulations stopped');
    }

    // Get status
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeUsers: Array.from(this.activeUsers),
            totalActiveUsers: this.activeUsers.size
        };
    }
}

module.exports = AutoLocationSimulator;