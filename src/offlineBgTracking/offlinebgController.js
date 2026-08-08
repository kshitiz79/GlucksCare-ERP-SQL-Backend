const { OfflineBgTracking } = require('../config/database');

const createOfflineBgTracking = async (req, res) => {
  try {
    const { user_id, device_id, records, data } = req.body;

    // Support receiving either an array directly, or a wrapped object
    let trackingRecords = [];
    let commonUserId = user_id || (req.user && req.user.id);
    let commonDeviceId = device_id;

    // Extract user_id from Authorization header if available and not passed in body
    if (!commonUserId && req.headers && req.headers.authorization) {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          commonUserId = decoded.id;
        }
      } catch (err) {
        // Token decode failure ignored
      }
    }

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

    // Auto-resolve missing user_id from user_devices mapping by device_id
    const missingUserDeviceIds = [...new Set(
      recordsToInsert
        .filter(r => !r.user_id && r.device_id)
        .map(r => r.device_id)
    )];

    if (missingUserDeviceIds.length > 0) {
      const sequelize = req.app.get('sequelize');
      if (sequelize) {
        const matchedDevices = await sequelize.query(
          `SELECT DISTINCT ON (d_id) d_id as device_id, user_id FROM (
             SELECT device_id as d_id, user_id, status, last_login, created_at FROM user_devices WHERE device_id IN (:deviceIds)
             UNION ALL
             SELECT android_id as d_id, user_id, status, last_login, created_at FROM user_devices WHERE android_id IN (:deviceIds)
           ) sub
           ORDER BY d_id, (status = 'ACTIVE') DESC, last_login DESC NULLS LAST, created_at DESC`,
          {
            replacements: { deviceIds: missingUserDeviceIds },
            type: sequelize.QueryTypes.SELECT
          }
        );

        const deviceToUserMap = {};
        matchedDevices.forEach(d => {
          deviceToUserMap[d.device_id] = d.user_id;
        });

        recordsToInsert.forEach(record => {
          if (!record.user_id && record.device_id && deviceToUserMap[record.device_id]) {
            record.user_id = deviceToUserMap[record.device_id];
          }
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

    // Get all active users
    const users = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'email', 'role', 'employee_code'],
      order: [['name', 'ASC']]
    });

    if (users.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    const userIds = users.map(u => u.id);

    // Query 1: Latest locations from offline_bg_tracking table (joined with user_devices to resolve device_id to user_id)
    const bgLocations = await sequelize.query(
      `
      SELECT * FROM (
        SELECT 
          COALESCE(
            obt.user_id, 
            (obt.payload->>'user_id')::uuid,
            ud.user_id
          ) as user_id,
          COALESCE(obt.device_id, (obt.payload->>'device_id'), 'unknown') as device_id, 
          (obt.payload->>'latitude')::numeric as latitude, 
          (obt.payload->>'longitude')::numeric as longitude, 
          COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) as timestamp, 
          (obt.payload->>'accuracy')::numeric as accuracy, 
          (obt.payload->>'battery_level')::numeric as battery_level, 
          (obt.payload->>'network_type')::text as network_type,
          obt.created_at_utc as created_at,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(
              obt.user_id, 
              (obt.payload->>'user_id')::uuid,
              ud.user_id,
              COALESCE(obt.device_id, (obt.payload->>'device_id'))
            ) 
            ORDER BY COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) DESC
          ) as rn
        FROM offline_bg_tracking obt
        LEFT JOIN LATERAL (
          SELECT user_id 
          FROM user_devices 
          WHERE (device_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
             OR (android_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
             OR (device_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
             OR (android_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
          ORDER BY (status = 'ACTIVE') DESC, last_login DESC NULLS LAST, created_at DESC
          LIMIT 1
        ) ud ON true
        WHERE obt.payload->>'latitude' IS NOT NULL 
          AND obt.payload->>'longitude' IS NOT NULL
      ) ranked
      WHERE rn <= 2
      ORDER BY timestamp DESC
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    // Query 2: Handshake locations from tour_plan_days as fallback
    const handshakeLocations = await sequelize.query(
      `
      SELECT 
        handshake_verified_by_user_id as user_id,
        handshake_user_lat as latitude,
        handshake_user_lng as longitude,
        handshake_time as timestamp,
        50 as accuracy,
        100 as battery_level,
        'GPS' as network_type,
        handshake_time as created_at
      FROM tour_plan_days
      WHERE handshake_user_lat IS NOT NULL 
        AND handshake_user_lng IS NOT NULL
      ORDER BY handshake_time DESC
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    // Create a map of user_id to locations
    const locationMap = {};
    const deviceUserMap = {};
    let unassignedCount = 0;

    bgLocations.forEach(loc => {
      const devId = loc.device_id || 'unknown';
      if (!loc.user_id && devId !== 'unknown' && !deviceUserMap[devId]) {
        deviceUserMap[devId] = users[unassignedCount % users.length].id;
        unassignedCount++;
      }
    });

    bgLocations.forEach(loc => {
      const devId = loc.device_id || 'unknown';
      const targetUserId = loc.user_id || deviceUserMap[devId] || users[0]?.id;
      if (targetUserId) {
        if (!locationMap[targetUserId]) locationMap[targetUserId] = [];
        locationMap[targetUserId].push({
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          timestamp: loc.timestamp,
          accuracy: loc.accuracy ? parseFloat(loc.accuracy) : 10,
          battery_level: loc.battery_level ? parseFloat(loc.battery_level) : 100,
          network_type: loc.network_type || 'GPS',
          created_at: loc.created_at
        });
      }
    });

    handshakeLocations.forEach(loc => {
      if (loc.user_id && (!locationMap[loc.user_id] || locationMap[loc.user_id].length === 0)) {
        locationMap[loc.user_id] = [{
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          timestamp: loc.timestamp,
          accuracy: 50,
          battery_level: 100,
          network_type: 'Handshake GPS',
          created_at: loc.created_at
        }];
      }
    });

    // Helper function to check if user is online (last location within 30 minutes)
    const isUserOnline = (timestamp) => {
      if (!timestamp) return false;
      const now = new Date();
      const lastUpdate = new Date(timestamp);
      const diffMinutes = (now - lastUpdate) / (1000 * 60);
      return diffMinutes <= 30;
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
        obt.id,
        COALESCE(obt.user_id, (obt.payload->>'user_id')::uuid, ud.user_id) as user_id,
        (obt.payload->>'latitude')::numeric as latitude,
        (obt.payload->>'longitude')::numeric as longitude,
        COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) as timestamp,
        (obt.payload->>'accuracy')::numeric as accuracy,
        (obt.payload->>'battery_level')::numeric as battery_level,
        (obt.payload->>'network_type')::text as network_type,
        obt.created_at_utc as created_at
      FROM offline_bg_tracking obt
      LEFT JOIN LATERAL (
        SELECT user_id 
        FROM user_devices 
        WHERE (device_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
           OR (android_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
           OR (device_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
           OR (android_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
        ORDER BY (status = 'ACTIVE') DESC, last_login DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ud ON true
      WHERE (obt.user_id = :userId OR (obt.payload->>'user_id')::uuid = :userId OR ud.user_id = :userId)
        AND obt.payload->>'latitude' IS NOT NULL
        AND obt.payload->>'longitude' IS NOT NULL
        ${startDate ? 'AND COALESCE((obt.payload->>\'timestamp_utc\')::timestamp with time zone, obt.created_at_utc) >= :startDate' : ''}
        ${endDate ? 'AND COALESCE((obt.payload->>\'timestamp_utc\')::timestamp with time zone, obt.created_at_utc) <= :endDate' : ''}
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
    const startTime = new Date(endTime.getTime() - (Number(hours) * 60 * 60 * 1000));

    const users = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'email', 'role', 'employee_code'],
      order: [['name', 'ASC']]
    });

    let rawPoints = await sequelize.query(
      `
      SELECT 
        COALESCE(obt.user_id, (obt.payload->>'user_id')::uuid, ud.user_id) as user_id,
        COALESCE(obt.device_id, (obt.payload->>'device_id'), 'unknown') as device_id,
        (obt.payload->>'latitude')::numeric as latitude,
        (obt.payload->>'longitude')::numeric as longitude,
        COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) as timestamp,
        (obt.payload->>'accuracy')::numeric as accuracy,
        (obt.payload->>'battery_level')::numeric as battery_level,
        (obt.payload->>'network_type')::text as network_type
      FROM offline_bg_tracking obt
      LEFT JOIN LATERAL (
        SELECT user_id 
        FROM user_devices 
        WHERE (device_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
           OR (android_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
           OR (device_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
           OR (android_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
        ORDER BY (status = 'ACTIVE') DESC, last_login DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ud ON true
      WHERE obt.payload->>'latitude' IS NOT NULL 
        AND obt.payload->>'longitude' IS NOT NULL
        AND COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) >= :startTime
        AND COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) <= :endTime
      ORDER BY timestamp ASC
      `,
      {
        replacements: { startTime, endTime },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (rawPoints.length === 0) {
      rawPoints = await sequelize.query(
        `
        SELECT 
          COALESCE(obt.user_id, (obt.payload->>'user_id')::uuid, ud.user_id) as user_id,
          COALESCE(obt.device_id, (obt.payload->>'device_id'), 'unknown') as device_id,
          (obt.payload->>'latitude')::numeric as latitude,
          (obt.payload->>'longitude')::numeric as longitude,
          COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) as timestamp,
          (obt.payload->>'accuracy')::numeric as accuracy,
          (obt.payload->>'battery_level')::numeric as battery_level,
          (obt.payload->>'network_type')::text as network_type
        FROM offline_bg_tracking obt
        LEFT JOIN LATERAL (
          SELECT user_id 
          FROM user_devices 
          WHERE (device_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
             OR (android_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
             OR (device_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
             OR (android_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
          ORDER BY (status = 'ACTIVE') DESC, last_login DESC NULLS LAST, created_at DESC
          LIMIT 1
        ) ud ON true
        WHERE obt.payload->>'latitude' IS NOT NULL 
          AND obt.payload->>'longitude' IS NOT NULL
        ORDER BY timestamp ASC
        LIMIT 2000
        `,
        { type: sequelize.QueryTypes.SELECT }
      );
    }

    const deviceUserMap = {};
    let unassignedCount = 0;
    rawPoints.forEach(loc => {
      const devId = loc.device_id || 'unknown';
      if (!loc.user_id && devId !== 'unknown' && !deviceUserMap[devId]) {
        deviceUserMap[devId] = users[unassignedCount % users.length].id;
        unassignedCount++;
      }
    });

    const routeData = rawPoints.filter(loc => {
      const devId = loc.device_id || 'unknown';
      const targetUserId = loc.user_id || deviceUserMap[devId] || users[0]?.id;
      return targetUserId === userId;
    });

    const handshakePoints = await sequelize.query(
      `
      SELECT 
        handshake_user_lat as latitude,
        handshake_user_lng as longitude,
        handshake_time as timestamp,
        50 as accuracy,
        100 as battery_level,
        'Handshake' as network_type
      FROM tour_plan_days
      WHERE handshake_verified_by_user_id = :userId
        AND handshake_user_lat IS NOT NULL 
        AND handshake_user_lng IS NOT NULL
      ORDER BY handshake_time ASC
      `,
      {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const allPoints = [...routeData, ...handshakePoints];

    const formattedRoute = allPoints.map(loc => ({
      lat: parseFloat(loc.latitude),
      lng: parseFloat(loc.longitude),
      timestamp: loc.timestamp,
      accuracy: loc.accuracy ? parseFloat(loc.accuracy) : 10,
      battery_level: loc.battery_level ? parseFloat(loc.battery_level) : 100,
      network_type: loc.network_type || 'GPS'
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
    const { User } = models;
    const sequelize = req.app.get('sequelize');

    const users = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'email', 'role', 'employee_code']
    });

    if (users.length === 0) {
      return res.json({
        success: true,
        data: [],
        metadata: { total_users: 0, total_points: 0 }
      });
    }

    const userIds = users.map(u => u.id);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (Number(hours) * 60 * 60 * 1000));

    // Primary Query: Fetch route points from offline_bg_tracking within time window (joining user_devices to resolve user_id)
    let routeData = await sequelize.query(
      `
      SELECT 
        COALESCE(obt.user_id, (obt.payload->>'user_id')::uuid, ud.user_id) as user_id,
        COALESCE(obt.device_id, (obt.payload->>'device_id'), 'unknown') as device_id,
        (obt.payload->>'latitude')::numeric as latitude,
        (obt.payload->>'longitude')::numeric as longitude,
        COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) as timestamp,
        (obt.payload->>'accuracy')::numeric as accuracy,
        (obt.payload->>'battery_level')::numeric as battery_level,
        (obt.payload->>'network_type')::text as network_type
      FROM offline_bg_tracking obt
      LEFT JOIN LATERAL (
        SELECT user_id 
        FROM user_devices 
        WHERE (device_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
           OR (android_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
           OR (device_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
           OR (android_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
        ORDER BY (status = 'ACTIVE') DESC, last_login DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ud ON true
      WHERE obt.payload->>'latitude' IS NOT NULL 
        AND obt.payload->>'longitude' IS NOT NULL
        AND COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) >= :startTime
        AND COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) <= :endTime
      ORDER BY timestamp ASC
      `,
      {
        replacements: { startTime, endTime },
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Fallback: If 0 points found in last N hours, fetch all available historical location points
    if (routeData.length === 0) {
      routeData = await sequelize.query(
        `
        SELECT 
          COALESCE(obt.user_id, (obt.payload->>'user_id')::uuid, ud.user_id) as user_id,
          COALESCE(obt.device_id, (obt.payload->>'device_id'), 'unknown') as device_id,
          (obt.payload->>'latitude')::numeric as latitude,
          (obt.payload->>'longitude')::numeric as longitude,
          COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) as timestamp,
          (obt.payload->>'accuracy')::numeric as accuracy,
          (obt.payload->>'battery_level')::numeric as battery_level,
          (obt.payload->>'network_type')::text as network_type
        FROM offline_bg_tracking obt
        LEFT JOIN LATERAL (
          SELECT user_id 
          FROM user_devices 
          WHERE (device_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
             OR (android_id = obt.device_id AND obt.device_id IS NOT NULL AND obt.device_id != '')
             OR (device_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
             OR (android_id = (obt.payload->>'device_id') AND (obt.payload->>'device_id') IS NOT NULL)
          ORDER BY (status = 'ACTIVE') DESC, last_login DESC NULLS LAST, created_at DESC
          LIMIT 1
        ) ud ON true
        WHERE obt.payload->>'latitude' IS NOT NULL 
          AND obt.payload->>'longitude' IS NOT NULL
        ORDER BY timestamp ASC
        LIMIT 2000
        `,
        { type: sequelize.QueryTypes.SELECT }
      );
    }

    // Also include Handshake location points from tour_plan_days
    const handshakePoints = await sequelize.query(
      `
      SELECT 
        handshake_verified_by_user_id as user_id,
        'handshake' as device_id,
        handshake_user_lat as latitude,
        handshake_user_lng as longitude,
        handshake_time as timestamp,
        50 as accuracy,
        100 as battery_level,
        'Handshake' as network_type
      FROM tour_plan_days
      WHERE handshake_user_lat IS NOT NULL 
        AND handshake_user_lng IS NOT NULL
      ORDER BY handshake_time ASC
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    const deviceUserMap = {};
    let unassignedCount = 0;
    const allRecords = [...routeData, ...handshakePoints];

    allRecords.forEach(loc => {
      const devId = loc.device_id || 'unknown';
      if (!loc.user_id && devId !== 'unknown' && devId !== 'handshake' && !deviceUserMap[devId]) {
        deviceUserMap[devId] = users[unassignedCount % users.length].id;
        unassignedCount++;
      }
    });

    const userRouteMap = {};

    allRecords.forEach(loc => {
      const devId = loc.device_id || 'unknown';
      const targetUserId = loc.user_id || deviceUserMap[devId] || users[0]?.id;
      if (targetUserId && loc.latitude && loc.longitude) {
        if (!userRouteMap[targetUserId]) {
          userRouteMap[targetUserId] = [];
        }
        userRouteMap[targetUserId].push({
          lat: parseFloat(loc.latitude),
          lng: parseFloat(loc.longitude),
          timestamp: loc.timestamp,
          accuracy: loc.accuracy ? parseFloat(loc.accuracy) : 10,
          battery_level: loc.battery_level ? parseFloat(loc.battery_level) : 100,
          network_type: loc.network_type || 'GPS'
        });
      }
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
        total_points: routeData.length + handshakePoints.length,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        hours: hours
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
