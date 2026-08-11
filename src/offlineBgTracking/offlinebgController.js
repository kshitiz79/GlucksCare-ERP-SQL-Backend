const { OfflineBgTracking, UserDevice } = require('../config/database');

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

    // Auto-bind device to user if user_id is authenticated/resolved and device has no binding yet
    try {
      const deviceUserPairs = [];
      const seenPairs = new Set();
      
      recordsToInsert.forEach(record => {
        if (record.device_id && record.user_id) {
          const key = `${record.device_id}_${record.user_id}`;
          if (!seenPairs.has(key)) {
            seenPairs.add(key);
            deviceUserPairs.push({
              device_id: record.device_id,
              user_id: record.user_id
            });
          }
        }
      });

      for (const pair of deviceUserPairs) {
        const existingBinding = await UserDevice.findOne({
          where: { device_id: pair.device_id }
        });

        if (!existingBinding) {
          // Automatic binding for new device uploading coordinates
          await UserDevice.create({
            user_id: pair.user_id,
            device_id: pair.device_id,
            android_id: pair.device_id,
            status: 'ACTIVE',
            is_active: true,
            last_login: new Date()
          });
          console.log(`[Auto-Bind] Bound device ${pair.device_id} to user ${pair.user_id} automatically.`);
        } else if (existingBinding.user_id === pair.user_id && existingBinding.status !== 'ACTIVE') {
          // Re-activate binding if it matches the current user uploading coordinates
          await existingBinding.update({
            status: 'ACTIVE',
            is_active: true,
            last_login: new Date()
          });
        }
      }
    } catch (bindErr) {
      console.warn('[Auto-Bind] Warning binding device automatically:', bindErr.message);
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
            obt.user_id::text, 
            (obt.payload->>'user_id'),
            ud.user_id::text
          )::uuid as user_id,
          COALESCE((obt.payload->>'tracking_session_id'), obt.device_id, (obt.payload->>'device_id'), 'unknown') as session_or_device, 
          (obt.payload->>'latitude')::numeric as latitude, 
          (obt.payload->>'longitude')::numeric as longitude, 
          COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) as timestamp, 
          (obt.payload->>'accuracy')::numeric as accuracy, 
          (obt.payload->>'battery_level')::numeric as battery_level, 
          (obt.payload->>'network_type')::text as network_type,
          obt.created_at_utc as created_at,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(
              obt.user_id::text, 
              (obt.payload->>'user_id'),
              ud.user_id::text,
              (obt.payload->>'tracking_session_id'),
              obt.device_id,
              (obt.payload->>'device_id')
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

    // Query 3: Latest Doctor/Chemist/Stockist Visit Check-in Locations for users without bg tracking
    const visitLocations = await sequelize.query(
      `
      SELECT DISTINCT ON (user_id)
        user_id,
        latitude,
        longitude,
        created_at as timestamp,
        30 as accuracy,
        100 as battery_level,
        'Visit Check-in' as network_type,
        created_at
      FROM (
        SELECT user_id, latitude, longitude, created_at FROM doctor_visits WHERE latitude IS NOT NULL
        UNION ALL
        SELECT user_id, latitude, longitude, created_at FROM chemist_visits WHERE latitude IS NOT NULL
        UNION ALL
        SELECT user_id, latitude, longitude, created_at FROM stockist_visits WHERE latitude IS NOT NULL
      ) visits
      ORDER BY user_id, created_at DESC
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    const locationMap = {};

    bgLocations.forEach(loc => {
      if (loc.user_id) {
        if (!locationMap[loc.user_id]) locationMap[loc.user_id] = [];
        locationMap[loc.user_id].push({
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

    visitLocations.forEach(loc => {
      if (loc.user_id && (!locationMap[loc.user_id] || locationMap[loc.user_id].length === 0)) {
        locationMap[loc.user_id] = [{
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          timestamp: loc.timestamp,
          accuracy: 30,
          battery_level: 100,
          network_type: 'Visit Check-in',
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
        COALESCE(
          obt.user_id::text, 
          (obt.payload->>'user_id'), 
          ud.user_id::text,
          visit_u.user_id::text
        )::uuid as user_id,
        COALESCE((obt.payload->>'tracking_session_id'), obt.device_id, (obt.payload->>'device_id'), 'unknown') as session_or_device,
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
      LEFT JOIN LATERAL (
        SELECT user_id FROM (
          SELECT user_id, date, latitude, longitude, created_at FROM doctor_visits WHERE latitude IS NOT NULL
          UNION ALL
          SELECT user_id, date, latitude, longitude, created_at FROM chemist_visits WHERE latitude IS NOT NULL
          UNION ALL
          SELECT user_id, date, latitude, longitude, created_at FROM stockist_visits WHERE latitude IS NOT NULL
        ) v
        WHERE ABS(v.latitude - (obt.payload->>'latitude')::numeric) < 0.25
          AND ABS(v.longitude - (obt.payload->>'longitude')::numeric) < 0.25
        ORDER BY (v.date = (COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc))::date) DESC, v.created_at DESC
        LIMIT 1
      ) visit_u ON true
      WHERE (obt.user_id::text = :userId OR (obt.payload->>'user_id') = :userId OR ud.user_id::text = :userId OR visit_u.user_id::text = :userId)
        AND obt.payload->>'latitude' IS NOT NULL 
        AND obt.payload->>'longitude' IS NOT NULL
        AND COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) >= :startTime
        AND COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) <= :endTime
      ORDER BY timestamp ASC
      `,
      {
        replacements: { userId, startTime, endTime },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (rawPoints.length === 0) {
      rawPoints = await sequelize.query(
        `
        SELECT 
          COALESCE(
            obt.user_id::text, 
            (obt.payload->>'user_id'), 
            ud.user_id::text,
            visit_u.user_id::text
          )::uuid as user_id,
          COALESCE((obt.payload->>'tracking_session_id'), obt.device_id, (obt.payload->>'device_id'), 'unknown') as session_or_device,
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
        LEFT JOIN LATERAL (
          SELECT user_id FROM (
            SELECT user_id, date, latitude, longitude, created_at FROM doctor_visits WHERE latitude IS NOT NULL
            UNION ALL
            SELECT user_id, date, latitude, longitude, created_at FROM chemist_visits WHERE latitude IS NOT NULL
            UNION ALL
            SELECT user_id, date, latitude, longitude, created_at FROM stockist_visits WHERE latitude IS NOT NULL
          ) v
          WHERE ABS(v.latitude - (obt.payload->>'latitude')::numeric) < 0.25
            AND ABS(v.longitude - (obt.payload->>'longitude')::numeric) < 0.25
          ORDER BY (v.date = (COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc))::date) DESC, v.created_at DESC
          LIMIT 1
        ) visit_u ON true
        WHERE (obt.user_id::text = :userId OR (obt.payload->>'user_id') = :userId OR ud.user_id::text = :userId OR visit_u.user_id::text = :userId)
          AND obt.payload->>'latitude' IS NOT NULL 
          AND obt.payload->>'longitude' IS NOT NULL
        ORDER BY timestamp ASC
        LIMIT 2000
        `,
        {
          replacements: { userId },
          type: sequelize.QueryTypes.SELECT
        }
      );
    }

    const routeData = rawPoints.filter(loc => loc.user_id === userId);

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
        AND handshake_time >= :startTime
        AND handshake_time <= :endTime
      ORDER BY handshake_time ASC
      `,
      {
        replacements: { userId, startTime, endTime },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const allPoints = [...routeData, ...handshakePoints];

    let formattedRoute = allPoints.map(pt => ({
      lat: parseFloat(pt.latitude),
      lng: parseFloat(pt.longitude),
      timestamp: pt.timestamp,
      accuracy: pt.accuracy ? parseFloat(pt.accuracy) : 10,
      battery_level: pt.battery_level ? parseFloat(pt.battery_level) : 100,
      network_type: pt.network_type || 'GPS'
    }));

    formattedRoute.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (formattedRoute.length === 0) {
      const visitPoints = await sequelize.query(
        `
        SELECT 
          latitude as lat,
          longitude as lng,
          created_at as timestamp,
          30 as accuracy,
          100 as battery_level,
          'Visit Check-in' as network_type
        FROM (
          SELECT user_id, latitude, longitude, created_at FROM doctor_visits WHERE user_id = :userId AND latitude IS NOT NULL AND created_at >= :startTime AND created_at <= :endTime
          UNION ALL
          SELECT user_id, latitude, longitude, created_at FROM chemist_visits WHERE user_id = :userId AND latitude IS NOT NULL AND created_at >= :startTime AND created_at <= :endTime
          UNION ALL
          SELECT user_id, latitude, longitude, created_at FROM stockist_visits WHERE user_id = :userId AND latitude IS NOT NULL AND created_at >= :startTime AND created_at <= :endTime
        ) visits
        ORDER BY created_at ASC
        `,
        {
          replacements: { userId, startTime, endTime },
          type: sequelize.QueryTypes.SELECT
        }
      );

      formattedRoute = visitPoints.map(pt => ({
        lat: parseFloat(pt.lat),
        lng: parseFloat(pt.lng),
        timestamp: pt.timestamp,
        accuracy: 30,
        battery_level: 100,
        network_type: 'Visit Check-in'
      }));

      formattedRoute.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

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

    // Primary Query: Fetch route points from offline_bg_tracking within time window (joining user_devices and visit check-ins to resolve user_id)
    let routeData = await sequelize.query(
      `
      SELECT 
        COALESCE(
          obt.user_id::text, 
          (obt.payload->>'user_id'), 
          ud.user_id::text,
          visit_u.user_id::text
        )::uuid as user_id,
        COALESCE((obt.payload->>'tracking_session_id'), obt.device_id, (obt.payload->>'device_id'), 'unknown') as session_or_device,
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
      LEFT JOIN LATERAL (
        SELECT user_id FROM (
          SELECT user_id, date, latitude, longitude, created_at FROM doctor_visits WHERE latitude IS NOT NULL
          UNION ALL
          SELECT user_id, date, latitude, longitude, created_at FROM chemist_visits WHERE latitude IS NOT NULL
          UNION ALL
          SELECT user_id, date, latitude, longitude, created_at FROM stockist_visits WHERE latitude IS NOT NULL
        ) v
        WHERE ABS(v.latitude - (obt.payload->>'latitude')::numeric) < 0.25
          AND ABS(v.longitude - (obt.payload->>'longitude')::numeric) < 0.25
        ORDER BY (v.date = (COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc))::date) DESC, v.created_at DESC
        LIMIT 1
      ) visit_u ON true
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
          COALESCE(
            obt.user_id::text, 
            (obt.payload->>'user_id'), 
            ud.user_id::text,
            visit_u.user_id::text
          )::uuid as user_id,
          COALESCE((obt.payload->>'tracking_session_id'), obt.device_id, (obt.payload->>'device_id'), 'unknown') as session_or_device,
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
        LEFT JOIN LATERAL (
          SELECT user_id FROM (
            SELECT user_id, date, latitude, longitude, created_at FROM doctor_visits WHERE latitude IS NOT NULL
            UNION ALL
            SELECT user_id, date, latitude, longitude, created_at FROM chemist_visits WHERE latitude IS NOT NULL
            UNION ALL
            SELECT user_id, date, latitude, longitude, created_at FROM stockist_visits WHERE latitude IS NOT NULL
          ) v
          WHERE ABS(v.latitude - (obt.payload->>'latitude')::numeric) < 0.25
            AND ABS(v.longitude - (obt.payload->>'longitude')::numeric) < 0.25
          ORDER BY (v.date = (COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc))::date) DESC, v.created_at DESC
          LIMIT 1
        ) visit_u ON true
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
        'handshake' as session_or_device,
        handshake_user_lat as latitude,
        handshake_user_lng as longitude,
        handshake_time as timestamp,
        50 as accuracy,
        100 as battery_level,
        'Handshake' as network_type
      FROM tour_plan_days
      WHERE handshake_user_lat IS NOT NULL 
        AND handshake_user_lng IS NOT NULL
        AND handshake_time >= :startTime
        AND handshake_time <= :endTime
      ORDER BY handshake_time ASC
      `,
      {
        replacements: { startTime, endTime },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const userRouteMap = {};
    const allRecords = [...routeData, ...handshakePoints];

    allRecords.forEach(loc => {
      if (loc.user_id && loc.latitude && loc.longitude) {
        if (!userRouteMap[loc.user_id]) {
          userRouteMap[loc.user_id] = [];
        }
        userRouteMap[loc.user_id].push({
          lat: parseFloat(loc.latitude),
          lng: parseFloat(loc.longitude),
          timestamp: loc.timestamp,
          accuracy: loc.accuracy ? parseFloat(loc.accuracy) : 10,
          battery_level: loc.battery_level ? parseFloat(loc.battery_level) : 100,
          network_type: loc.network_type || 'GPS'
        });
      }
    });

    // Query Doctor/Chemist/Stockist visit locations for users with 0 route points
    const userVisitLocations = await sequelize.query(
      `
      SELECT 
        user_id,
        latitude as lat,
        longitude as lng,
        created_at as timestamp,
        30 as accuracy,
        100 as battery_level,
        'Visit Check-in' as network_type
      FROM (
        SELECT user_id, latitude, longitude, created_at FROM doctor_visits WHERE latitude IS NOT NULL AND created_at >= :startTime AND created_at <= :endTime
        UNION ALL
        SELECT user_id, latitude, longitude, created_at FROM chemist_visits WHERE latitude IS NOT NULL AND created_at >= :startTime AND created_at <= :endTime
        UNION ALL
        SELECT user_id, latitude, longitude, created_at FROM stockist_visits WHERE latitude IS NOT NULL AND created_at >= :startTime AND created_at <= :endTime
      ) visits
      ORDER BY user_id, created_at ASC
      `,
      {
        replacements: { startTime, endTime },
        type: sequelize.QueryTypes.SELECT
      }
    );

    userVisitLocations.forEach(loc => {
      if (loc.user_id && (!userRouteMap[loc.user_id] || userRouteMap[loc.user_id].length === 0)) {
        if (!userRouteMap[loc.user_id]) userRouteMap[loc.user_id] = [];
        userRouteMap[loc.user_id].push({
          lat: parseFloat(loc.lat),
          lng: parseFloat(loc.lng),
          timestamp: loc.timestamp,
          accuracy: 30,
          battery_level: 100,
          network_type: 'Visit Check-in'
        });
      }
    });

    // Sort each user's route points by timestamp ASC to ensure chronological order
    Object.keys(userRouteMap).forEach(uid => {
      if (userRouteMap[uid]) {
        userRouteMap[uid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
    });

    // Fetch active device mappings
    const activeDevices = await sequelize.query(
      `SELECT user_id, device_id FROM user_devices WHERE status = 'ACTIVE'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const deviceMap = {};
    activeDevices.forEach(d => {
      if (d.user_id) {
        deviceMap[d.user_id] = d.device_id;
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
          employee_code: user.employee_code,
          device_id: deviceMap[user.id] || null
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

const getDevicesList = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');
    const models = req.app.get('models');
    const { User } = models;

    const devices = await sequelize.query(
      `
      SELECT 
        d.device_id,
        COALESCE(ud.user_id::text, d.payload_user_id::text, d.obt_user_id::text)::uuid as user_id,
        d.total_points,
        d.first_seen,
        d.last_seen,
        d.last_latitude,
        d.last_longitude,
        d.last_speed,
        d.last_accuracy,
        d.last_battery_level,
        d.last_network_type,
        ud.device_name,
        ud.device_type,
        ud.status as binding_status
      FROM (
        SELECT 
          COALESCE(obt.device_id, (obt.payload->>'device_id'), 'unknown') as device_id,
          MAX(obt.user_id::text) as obt_user_id,
          MAX(obt.payload->>'user_id') as payload_user_id,
          COUNT(*) as total_points,
          MIN(COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc)) as first_seen,
          MAX(COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc)) as last_seen,
          (ARRAY_AGG((obt.payload->>'latitude')::numeric ORDER BY COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) DESC))[1] as last_latitude,
          (ARRAY_AGG((obt.payload->>'longitude')::numeric ORDER BY COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) DESC))[1] as last_longitude,
          (ARRAY_AGG((obt.payload->>'speed')::numeric ORDER BY COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) DESC))[1] as last_speed,
          (ARRAY_AGG((obt.payload->>'accuracy')::numeric ORDER BY COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) DESC))[1] as last_accuracy,
          (ARRAY_AGG((obt.payload->>'battery_level')::numeric ORDER BY COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) DESC))[1] as last_battery_level,
          (ARRAY_AGG((obt.payload->>'network_type')::text ORDER BY COALESCE((obt.payload->>'timestamp_utc')::timestamp with time zone, obt.created_at_utc) DESC))[1] as last_network_type
        FROM offline_bg_tracking obt
        WHERE COALESCE(obt.device_id, (obt.payload->>'device_id')) IS NOT NULL
        GROUP BY COALESCE(obt.device_id, (obt.payload->>'device_id'), 'unknown')
      ) d
      LEFT JOIN LATERAL (
        SELECT user_id, device_name, device_type, status 
        FROM user_devices 
        WHERE device_id = d.device_id OR android_id = d.device_id
        ORDER BY (status = 'ACTIVE') DESC, last_login DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) ud ON true
      ORDER BY d.last_seen DESC
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    const userIds = [...new Set(devices.map(d => d.user_id).filter(Boolean))];
    const usersMap = {};
    if (userIds.length > 0) {
      const users = await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'name', 'email', 'role', 'employee_code']
      });
      users.forEach(u => { usersMap[u.id] = u; });
    }

    const formattedDevices = devices.map(d => {
      const u = d.user_id ? usersMap[d.user_id] : null;
      const lastSeenDate = new Date(d.last_seen);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

      return {
        device_id: d.device_id,
        user_id: d.user_id,
        user_name: u ? u.name : 'Unassigned Device',
        user_email: u ? u.email : null,
        employee_code: u ? u.employee_code : null,
        user_role: u ? u.role : null,
        total_points: parseInt(d.total_points || 0),
        first_seen: d.first_seen,
        last_seen: d.last_seen,
        minutes_ago: diffMinutes,
        is_active_now: diffMinutes <= 30,
        last_coordinate: {
          latitude: d.last_latitude ? parseFloat(d.last_latitude) : null,
          longitude: d.last_longitude ? parseFloat(d.last_longitude) : null,
          speed: d.last_speed ? parseFloat(d.last_speed) : 0,
          accuracy: d.last_accuracy ? parseFloat(d.last_accuracy) : 10,
          battery_level: d.last_battery_level ? parseFloat(d.last_battery_level) : 100,
          network_type: d.last_network_type || 'GPS'
        },
        device_name: d.device_name,
        device_type: d.device_type,
        binding_status: d.binding_status || (u ? 'AUTO_MATCHED' : 'UNASSIGNED')
      };
    });

    res.json({
      success: true,
      data: formattedDevices,
      metadata: {
        total_devices: formattedDevices.length,
        active_now: formattedDevices.filter(d => d.is_active_now).length,
        unassigned: formattedDevices.filter(d => !d.user_id).length
      }
    });

  } catch (error) {
    console.error('Error in getDevicesList:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const bindDeviceToUser = async (req, res) => {
  try {
    const { device_id, user_id } = req.body;
    if (!device_id || !user_id) {
      return res.status(400).json({ success: false, message: 'device_id and user_id are required' });
    }

    const models = req.app.get('models');
    const { UserDevice, User } = models;

    const targetUser = await User.findByPk(user_id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let [device, created] = await UserDevice.findOrCreate({
      where: { device_id },
      defaults: {
        user_id,
        device_id,
        android_id: device_id,
        status: 'ACTIVE',
        is_active: true,
        last_login: new Date()
      }
    });

    if (!created) {
      await device.update({
        user_id,
        status: 'ACTIVE',
        is_active: true,
        last_login: new Date()
      });
    }

    res.json({
      success: true,
      message: `Device ${device_id} bound to ${targetUser.name} successfully`,
      data: device
    });
  } catch (error) {
    console.error('Error in bindDeviceToUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOfflineBgTracking,
  getAllOfflineBgTracking,
  getOfflineBgTrackingById,
  getUsersWithLocation,
  getUserLocationHistory,
  getUserRouteData,
  getAllUsersRouteData,
  getDevicesList,
  bindDeviceToUser
};
