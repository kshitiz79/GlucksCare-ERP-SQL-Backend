const { OfflineBgTracking } = require('../config/database');

const createOfflineBgTracking = async (req, res) => {
  try {
    const { user_id, device_id, records, data } = req.body;

    // Support receiving either an array directly, or a wrapped object
    let trackingRecords = [];
    let commonUserId = user_id || (req.user && req.user.id);
    let commonDeviceId = device_id;

    if (Array.isArray(req.body)) {
      trackingRecords = req.body;
    } else if (Array.isArray(records)) {
      trackingRecords = records;
    } else if (Array.isArray(data)) {
      trackingRecords = data;
    } else {
      // If it's a single object that has details
      if (req.body.entity_type && req.body.payload) {
        trackingRecords = [req.body];
      }
    }

    if (!trackingRecords || trackingRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No tracking records provided or invalid format'
      });
    }

    // Map user_id and device_id from the outer object onto each record
    const recordsToInsert = trackingRecords.map(record => {
      return {
        user_id: record.user_id || commonUserId || null,
        device_id: record.device_id || commonDeviceId || null,
        entity_type: record.entity_type,
        entity_id: record.entity_id,
        payload: record.payload,
        status: record.status || 'PENDING',
        retry_count: record.retry_count || 0,
        created_at_utc: record.created_at_utc || new Date(),
        last_attempt_utc: record.last_attempt_utc || null
      };
    });

    // Validate that required fields are present
    for (const record of recordsToInsert) {
      if (!record.device_id) {
        return res.status(400).json({
          success: false,
          message: 'device_id is required for all records'
        });
      }
      if (!record.entity_type || !record.entity_id || !record.payload) {
        return res.status(400).json({
          success: false,
          message: 'entity_type, entity_id, and payload are required for all records'
        });
      }
    }

    // Bulk create records (handling duplicates on entity_id)
    const result = await OfflineBgTracking.bulkCreate(recordsToInsert, {
      updateOnDuplicate: ['status', 'retry_count', 'last_attempt_utc', 'payload']
    });

    res.status(201).json({
      success: true,
      message: `${result.length} tracking records stored successfully`,
      count: result.length
    });
  } catch (error) {
    console.error('Error creating offline bg tracking records:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save offline tracking records'
    });
  }
};

const getAllOfflineBgTracking = async (req, res) => {
  try {
    const records = await OfflineBgTracking.findAll({
      order: [['created_at_utc', 'DESC']]
    });
    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getOfflineBgTrackingById = async (req, res) => {
  try {
    const record = await OfflineBgTracking.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Offline tracking record not found'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getUsersWithLocation = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { User, OfflineBgTracking } = models;
    const sequelize = req.app.get('sequelize');

    console.log('Fetching users with latest locations from offlinebg...');
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

    if (!OfflineBgTracking || users.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'No users or OfflineBgTracking model not available'
      });
    }

    const userIds = users.map(u => u.id);

    // Get last 2 locations per user for showing movement/direction from offline_bg_tracking
    const latestLocations = await sequelize.query(
      `
      SELECT * FROM (
        SELECT 
          user_id, 
          (payload->>'latitude')::numeric as latitude, 
          (payload->>'longitude')::numeric as longitude, 
          COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc) as timestamp, 
          (payload->>'accuracy')::numeric as accuracy, 
          (payload->>'battery_level')::numeric as battery_level, 
          (payload->>'network_type')::text as network_type,
          created_at_utc as created_at,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at_utc DESC) as rn
        FROM offline_bg_tracking
        WHERE entity_type = 'location' AND user_id = ANY($1::uuid[])
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
      .filter(user => locationMap[user.id] && locationMap[user.id].length > 0)
      .map(user => {
        const locations = locationMap[user.id];
        const latestLocation = locations[0];
        const previousLocation = locations[1] || null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employee_code: user.employee_code,
          last_location: latestLocation,
          previous_location: previousLocation,
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

const getUserLocationHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    const sequelize = req.app.get('sequelize');

    const locations = await sequelize.query(
      `
      SELECT 
        id,
        user_id,
        (payload->>'latitude')::numeric as latitude,
        (payload->>'longitude')::numeric as longitude,
        COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc) as timestamp,
        (payload->>'accuracy')::numeric as accuracy,
        (payload->>'battery_level')::numeric as battery_level,
        (payload->>'network_type')::text as network_type,
        created_at_utc as created_at
      FROM offline_bg_tracking
      WHERE user_id = :userId 
        AND entity_type = 'location'
        ${startDate ? 'AND COALESCE((payload->>\'timestamp_utc\')::timestamp with time zone, created_at_utc) >= :startDate' : ''}
        ${endDate ? 'AND COALESCE((payload->>\'timestamp_utc\')::timestamp with time zone, created_at_utc) <= :endDate' : ''}
      ORDER BY timestamp DESC
      LIMIT :limit
      `,
      {
        replacements: { 
          userId, 
          startDate: startDate ? new Date(startDate) : null, 
          endDate: endDate ? new Date(endDate) : null, 
          limit: parseInt(limit) 
        },
        type: sequelize.QueryTypes.SELECT
      }
    );

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

const getUserRouteData = async (req, res) => {
  try {
    const { userId } = req.params;
    const { hours = 24 } = req.query;

    const models = req.app.get('models');
    const { User } = models;
    const sequelize = req.app.get('sequelize');

    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'role', 'employee_code']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));

    console.log(`Fetching route data for user ${userId} from ${startTime.toISOString()} to ${endTime.toISOString()}`);

    const routeData = await sequelize.query(
      `
      WITH time_buckets AS (
        SELECT 
          user_id,
          (payload->>'latitude')::numeric as latitude,
          (payload->>'longitude')::numeric as longitude,
          COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc) as timestamp,
          (payload->>'accuracy')::numeric as accuracy,
          (payload->>'battery_level')::numeric as battery_level,
          (payload->>'network_type')::text as network_type,
          DATE_TRUNC('hour', COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc)) + 
          INTERVAL '10 minutes' * FLOOR(EXTRACT(MINUTE FROM COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc)) / 10) as time_bucket
        FROM offline_bg_tracking
        WHERE user_id = $1
          AND entity_type = 'location'
          AND COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc) >= $2
          AND COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc) <= $3
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

const getAllUsersRouteData = async (req, res) => {
  try {
    const { hours = 24 } = req.query;

    const models = req.app.get('models');
    const { User, OfflineBgTracking } = models;
    const sequelize = req.app.get('sequelize');

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

    const routeData = await sequelize.query(
      `
      WITH time_buckets AS (
        SELECT 
          user_id,
          (payload->>'latitude')::numeric as latitude,
          (payload->>'longitude')::numeric as longitude,
          COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc) as timestamp,
          (payload->>'accuracy')::numeric as accuracy,
          (payload->>'battery_level')::numeric as battery_level,
          (payload->>'network_type')::text as network_type,
          DATE_TRUNC('hour', COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc)) + 
          INTERVAL '10 minutes' * FLOOR(EXTRACT(MINUTE FROM COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc)) / 10) as time_bucket
        FROM offline_bg_tracking
        WHERE user_id = ANY($1::uuid[])
          AND entity_type = 'location'
          AND COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc) >= $2
          AND COALESCE((payload->>'timestamp_utc')::timestamp with time zone, created_at_utc) <= $3
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
  createOfflineBgTracking,
  getAllOfflineBgTracking,
  getOfflineBgTrackingById,
  getUsersWithLocation,
  getUserLocationHistory,
  getUserRouteData,
  getAllUsersRouteData
};
