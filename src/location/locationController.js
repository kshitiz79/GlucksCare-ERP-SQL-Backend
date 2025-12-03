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

// GET filtered route data for a specific user (optimized for Google Maps)
// Returns 1 coordinate per 10 minutes for the last 24 hours
const getUserRouteData = async (req, res) => {
  try {
    const { userId } = req.params;
    const { hours = 24 } = req.query; // Default to 24 hours

    const models = req.app.get('models');
    const { Location, User } = models;
    const sequelize = req.app.get('sequelize');

    if (!Location) {
      return res.status(404).json({
        success: false,
        message: 'Location model not available'
      });
    }

    // Get user info
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'role', 'employee_code']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate time range
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));

    console.log(`Fetching route data for user ${userId} from ${startTime.toISOString()} to ${endTime.toISOString()}`);

    // OPTIMIZED QUERY: Get 1 location per 10-minute interval
    // This uses PostgreSQL's DISTINCT ON with time bucketing
    const routeData = await sequelize.query(
      `
      WITH time_buckets AS (
        SELECT 
          user_id,
          latitude,
          longitude,
          timestamp,
          accuracy,
          battery_level,
          network_type,
          -- Create 10-minute time buckets
          DATE_TRUNC('hour', timestamp) + 
          INTERVAL '10 minutes' * FLOOR(EXTRACT(MINUTE FROM timestamp) / 10) as time_bucket
        FROM locations
        WHERE user_id = $1
          AND timestamp >= $2
          AND timestamp <= $3
        ORDER BY timestamp ASC
      ),
      ranked_locations AS (
        SELECT 
          user_id,
          latitude,
          longitude,
          timestamp,
          accuracy,
          battery_level,
          network_type,
          time_bucket,
          -- Get the first location in each 10-minute bucket
          ROW_NUMBER() OVER (PARTITION BY time_bucket ORDER BY timestamp ASC) as rn
        FROM time_buckets
      )
      SELECT 
        latitude,
        longitude,
        timestamp,
        accuracy,
        battery_level,
        network_type
      FROM ranked_locations
      WHERE rn = 1
      ORDER BY timestamp ASC
      `,
      {
        bind: [userId, startTime, endTime],
        type: sequelize.QueryTypes.SELECT
      }
    );

    console.log(`Found ${routeData.length} filtered location points (1 per 10 min)`);

    // Format the response
    const formattedRoute = routeData.map(loc => ({
      lat: parseFloat(loc.latitude),
      lng: parseFloat(loc.longitude),
      timestamp: loc.timestamp,
      accuracy: loc.accuracy,
      battery_level: loc.battery_level,
      network_type: loc.network_type
    }));

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employee_code: user.employee_code
        },
        route: formattedRoute,
        metadata: {
          total_points: formattedRoute.length,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          hours: hours,
          interval_minutes: 10
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user route data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user route data'
    });
  }
};

// GET route data for all users (optimized)
const getAllUsersRouteData = async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const models = req.app.get('models');
    const { Location, User } = models;
    const sequelize = req.app.get('sequelize');

    if (!Location) {
      return res.status(404).json({
        success: false,
        message: 'Location model not available'
      });
    }

    // Get all active users
    const users = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'email', 'role', 'employee_code']
    });

    if (users.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No active users found'
      });
    }

    const userIds = users.map(u => u.id);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));

    console.log(`Fetching route data for ${users.length} users`);

    // Get filtered locations for all users
    const routeData = await sequelize.query(
      `
      WITH time_buckets AS (
        SELECT 
          user_id,
          latitude,
          longitude,
          timestamp,
          accuracy,
          battery_level,
          network_type,
          DATE_TRUNC('hour', timestamp) + 
          INTERVAL '10 minutes' * FLOOR(EXTRACT(MINUTE FROM timestamp) / 10) as time_bucket
        FROM locations
        WHERE user_id = ANY($1::uuid[])
          AND timestamp >= $2
          AND timestamp <= $3
        ORDER BY timestamp ASC
      ),
      ranked_locations AS (
        SELECT 
          user_id,
          latitude,
          longitude,
          timestamp,
          accuracy,
          battery_level,
          network_type,
          time_bucket,
          ROW_NUMBER() OVER (PARTITION BY user_id, time_bucket ORDER BY timestamp ASC) as rn
        FROM time_buckets
      )
      SELECT 
        user_id,
        latitude,
        longitude,
        timestamp,
        accuracy,
        battery_level,
        network_type
      FROM ranked_locations
      WHERE rn = 1
      ORDER BY user_id, timestamp ASC
      `,
      {
        bind: [userIds, startTime, endTime],
        type: sequelize.QueryTypes.SELECT
      }
    );

    console.log(`Found ${routeData.length} total filtered location points`);

    // Group by user
    const userRouteMap = {};
    routeData.forEach(loc => {
      if (!userRouteMap[loc.user_id]) {
        userRouteMap[loc.user_id] = [];
      }
      userRouteMap[loc.user_id].push({
        lat: parseFloat(loc.latitude),
        lng: parseFloat(loc.longitude),
        timestamp: loc.timestamp,
        accuracy: loc.accuracy,
        battery_level: loc.battery_level,
        network_type: loc.network_type
      });
    });

    // Combine with user data
    const usersWithRoutes = users
      .filter(user => userRouteMap[user.id] && userRouteMap[user.id].length > 0)
      .map(user => ({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employee_code: user.employee_code
        },
        route: userRouteMap[user.id],
        total_points: userRouteMap[user.id].length
      }));

    res.json({
      success: true,
      data: usersWithRoutes,
      metadata: {
        total_users: usersWithRoutes.length,
        total_points: routeData.length,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        hours: hours,
        interval_minutes: 10
      }
    });

  } catch (error) {
    console.error('Error fetching all users route data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch users route data'
    });
  }
};

module.exports = {
  getUsersWithLocation,
  getUserLocationHistory,
  getUserRouteData,
  getAllUsersRouteData
};
