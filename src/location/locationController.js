// Location Controller for Live Location Tracking

// GET all users with their latest location
const getUsersWithLocation = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { User, Location } = models;
    const sequelize = req.app.get('sequelize');

    console.log('Fetching users with latest locations...');
    const t0 = Date.now();

    // Get all active users
    const users = await User.findAll({
      where: {
        is_active: true
      },
      attributes: ['id', 'name', 'email', 'role', 'employee_code'],
      order: [['name', 'ASC']]
    });

    const t1 = Date.now();
    console.log(`Found ${users.length} active users in ${t1 - t0}ms`);

    if (!Location || users.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No users or location model not available'
      });
    }

    const userIds = users.map(u => u.id);

    // OPTIMIZED: Get last 2 locations per user for showing movement/direction
    // Use bind parameter with proper array handling
    const latestLocations = await sequelize.query(
      `
      SELECT * FROM (
        SELECT 
          user_id, 
          latitude, 
          longitude, 
          timestamp, 
          accuracy, 
          battery_level, 
          network_type,
          created_at,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY timestamp DESC) as rn
        FROM locations
        WHERE user_id = ANY($1::uuid[])
      ) ranked
      WHERE rn <= 2
      ORDER BY user_id, timestamp DESC
      `,
      {
        bind: [userIds],
        type: sequelize.QueryTypes.SELECT
      }
    );

    const t2 = Date.now();
    console.log(`Found ${latestLocations.length} location records (last 2 per user) in ${t2 - t1}ms`);

    // Create a map of user_id to locations array (last 2)
    const locationMap = {};
    latestLocations.forEach(loc => {
      if (!locationMap[loc.user_id]) {
        locationMap[loc.user_id] = [];
      }
      locationMap[loc.user_id].push({
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        timestamp: loc.timestamp,
        accuracy: loc.accuracy,
        battery_level: loc.battery_level,
        network_type: loc.network_type,
        created_at: loc.created_at
      });
    });

    // Helper function to check if user is online (last location within 15 minutes)
    const isUserOnline = (timestamp) => {
      if (!timestamp) return false;
      const now = new Date();
      const lastUpdate = new Date(timestamp);
      const diffMinutes = (now - lastUpdate) / (1000 * 60);
      return diffMinutes <= 15;
    };

    // Combine users with their locations
    const usersWithLocation = users
      .filter(user => locationMap[user.id] && locationMap[user.id].length > 0) // Only include users with location data
      .map(user => {
        const locations = locationMap[user.id];
        const latestLocation = locations[0]; // Most recent
        const previousLocation = locations[1] || null; // Second most recent (if exists)
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employee_code: user.employee_code,
          last_location: latestLocation,
          previous_location: previousLocation, // For showing movement/direction
          is_online: isUserOnline(latestLocation.timestamp)
        };
      });

    const t3 = Date.now();
    console.log(`Total processing time: ${t3 - t0}ms`);

    res.json({
      success: true,
      data: usersWithLocation,
      count: usersWithLocation.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching users with location:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch users with location'
    });
  }
};

// GET location history for a specific user
const getUserLocationHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    const models = req.app.get('models');
    const { Location } = models;

    if (!Location) {
      return res.status(404).json({
        success: false,
        message: 'Location model not available'
      });
    }

    const whereClause = { user_id: userId };

    // Add date filters if provided
    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) whereClause.timestamp.$gte = new Date(startDate);
      if (endDate) whereClause.timestamp.$lte = new Date(endDate);
    }

    const locations = await Location.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      attributes: [
        'id',
        'latitude',
        'longitude',
        'timestamp',
        'accuracy',
        'battery_level',
        'network_type',
        'created_at'
      ]
    });

    res.json({
      success: true,
      data: locations,
      count: locations.length
    });

  } catch (error) {
    console.error('Error fetching location history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch location history'
    });
  }
};

module.exports = {
  getUsersWithLocation,
  getUserLocationHistory
};
