// src/locationEvent/locationEventController.js

// GET all location events
const getAllLocationEvents = async (req, res) => {
  try {
    const { LocationEvent } = req.app.get('models');
    const locationEvents = await LocationEvent.findAll();
    res.json({
      success: true,
      count: locationEvents.length,
      data: locationEvents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET location event by ID
const getLocationEventById = async (req, res) => {
  try {
    const { LocationEvent } = req.app.get('models');
    const locationEvent = await LocationEvent.findByPk(req.params.id);
    if (!locationEvent) {
      return res.status(404).json({
        success: false,
        message: 'Location event not found'
      });
    }
    res.json({
      success: true,
      data: locationEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new location event
const createLocationEvent = async (req, res) => {
  try {
    const { LocationEvent, Location, User } = req.app.get('models');
    const { 
      user_id, 
      device_id, 
      event_type, 
      latitude, 
      longitude, 
      timestamp, 
      metadata 
    } = req.body;

    console.log('Received location event:', req.body);

    // Validate required fields (user_id is now optional)
    if (!device_id || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: device_id, latitude, longitude'
      });
    }

    // Find user by user_id or device_id
    let user = null;
    let actualUserId = user_id;
    
    if (user_id) {
      // If user_id is provided, find user directly
      user = await User.findByPk(user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    } else if (device_id) {
      // If only device_id is provided, try to find user from device mapping
      const { UserDevice } = req.app.get('models');
      
      const userDevice = await UserDevice.findOne({
        where: { 
          device_id,
          is_active: true 
        },
        include: [{
          model: User,
          attributes: ['id', 'name', 'email', 'role']
        }]
      });
      
      if (userDevice && userDevice.User) {
        user = userDevice.User;
        actualUserId = user.id;
        console.log(`📱 Found user from device mapping: ${user.name} (${user.id})`);
      } else {
        // Fallback: try to find user from previous location records
        const previousLocation = await Location.findOne({
          where: { device_id },
          include: [{
            model: User,
            attributes: ['id', 'name', 'email', 'role']
          }],
          order: [['timestamp', 'DESC']]
        });
        
        if (previousLocation && previousLocation.User) {
          user = previousLocation.User;
          actualUserId = user.id;
          console.log(`📱 Found user from previous location: ${user.name} (${user.id})`);
        } else {
          // If no user found, create a record without user_id
          console.log(`⚠️ No user found for device_id: ${device_id}, storing location without user mapping`);
          actualUserId = null;
        }
      }
    }

    // Always use current Indian time for consistency
    const currentIndianTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    
    // Create location event with current Indian time
    const locationEventData = {
      ...req.body,
      timestamp: currentIndianTime
    };
    const locationEvent = await LocationEvent.create(locationEventData);

    // Also create location record for tracking with current Indian time
    const locationData = {
      user_id: actualUserId,
      device_id,
      latitude,
      longitude,
      timestamp: currentIndianTime,
      accuracy: metadata?.accuracy || null,
      battery_level: metadata?.battery_level || null,
      network_type: metadata?.network_type || null,
      speed: metadata?.speed || null
    };

    const location = await Location.create(locationData);

    console.log('Location event and location created successfully');

    // Emit real-time update via WebSocket to all connected admins
    const io = req.app.get('io');
    if (io) {
      io.emit('user-location-update', {
        userId: actualUserId,
        deviceId: device_id,
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
        speed: metadata?.speed || 0,
        accuracy: metadata?.accuracy || 0,
        timestamp: currentIndianTime.toISOString(),
        batteryLevel: metadata?.battery_level || null,
        networkType: metadata?.network_type || null,
        user: user ? {
          name: user.name,
          email: user.email,
          role: user.role
        } : {
          name: `Device ${device_id}`,
          email: 'unknown@device.com',
          role: 'Mobile User'
        }
      });
      console.log('WebSocket location update emitted for device:', device_id, 'user:', actualUserId || 'unknown', 'at', currentIndianTime.toLocaleString());
    }

    res.status(201).json({
      success: true,
      message: 'Location event received and processed',
      data: {
        locationEvent,
        location
      }
    });
  } catch (error) {
    console.error('Error creating location event:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a location event
const updateLocationEvent = async (req, res) => {
  try {
    const { LocationEvent } = req.app.get('models');
    const locationEvent = await LocationEvent.findByPk(req.params.id);
    if (!locationEvent) {
      return res.status(404).json({
        success: false,
        message: 'Location event not found'
      });
    }
    
    await locationEvent.update(req.body);
    res.json({
      success: true,
      data: locationEvent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a location event
const deleteLocationEvent = async (req, res) => {
  try {
    const { LocationEvent } = req.app.get('models');
    const locationEvent = await LocationEvent.findByPk(req.params.id);
    if (!locationEvent) {
      return res.status(404).json({
        success: false,
        message: 'Location event not found'
      });
    }
    
    await locationEvent.destroy();
    res.json({
      success: true,
      message: 'Location event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLocationEvents,
  getLocationEventById,
  createLocationEvent,
  updateLocationEvent,
  deleteLocationEvent
};