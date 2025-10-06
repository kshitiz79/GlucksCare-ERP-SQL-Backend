// src/location/locationController.js

// GET all locations
const getAllLocations = async (req, res) => {
  try {
    const { Location } = req.app.get('models');

    console.log('Fetching locations with query params:', req.query);

    // Support filtering by user_id if provided
    const whereClause = {};
    if (req.query.user_id) {
      whereClause.user_id = req.query.user_id;
    }

    const options = {
      where: whereClause
    };

    // Add limit if specified
    if (req.query.limit) {
      options.limit = parseInt(req.query.limit);
    }

    console.log('Location query options:', options);

    const locations = await Location.findAll(options);

    console.log('Found locations:', locations.length);

    res.json({
      success: true,
      count: locations.length,
      data: locations
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations: ' + error.message
    });
  }
};

// GET location by ID
const getLocationById = async (req, res) => {
  try {
    const { Location } = req.app.get('models');
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location record not found'
      });
    }
    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new location
const createLocation = async (req, res) => {
  try {
    const { Location } = req.app.get('models');
    const location = await Location.create(req.body);
    res.status(201).json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a location
const updateLocation = async (req, res) => {
  try {
    const { Location } = req.app.get('models');
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location record not found'
      });
    }

    await location.update(req.body);
    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a location
const deleteLocation = async (req, res) => {
  try {
    const { Location } = req.app.get('models');
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location record not found'
      });
    }

    await location.destroy();
    res.json({
      success: true,
      message: 'Location record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET user location history with pagination and time range
const getUserLocationHistory = async (req, res) => {
  try {
    const { Location } = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { Op } = sequelize.Sequelize;
    const { userId } = req.params;
    const { startDate, endDate, limit = 500, offset = 0, sort = 'desc' } = req.query;

    console.log('Fetching user location history:', {
      userId,
      startDate,
      endDate,
      limit,
      offset,
      sort
    });

    // Build where clause
    const whereClause = {
      user_id: userId
    };

    // Add time range filter if provided
    if (startDate && endDate) {
      whereClause.timestamp = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      whereClause.timestamp = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.timestamp = {
        [Op.lte]: new Date(endDate)
      };
    }

    // Query options
    const options = {
      where: whereClause,
      limit: Math.min(parseInt(limit), 1000), // Max 1000 points
      offset: parseInt(offset),
      order: [['timestamp', sort.toUpperCase()]],
      // Removed 'speed' as it doesn't exist in database yet
      attributes: ['id', 'user_id', 'latitude', 'longitude', 'timestamp', 'accuracy', 'battery_level', 'network_type']
    };

    console.log('Query options:', JSON.stringify(options, null, 2));

    // Fetch locations
    const locations = await Location.findAll(options);

    // Get total count for pagination
    const totalCount = await Location.count({ where: whereClause });

    console.log(`Found ${locations.length} locations out of ${totalCount} total`);

    res.json({
      success: true,
      data: {
        locations,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + locations.length) < totalCount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user location history:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user location history: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    });
  }
};

// Test endpoint to verify route is working
const testUserHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    res.json({
      success: true,
      message: 'User history endpoint is working',
      userId: userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  getUserLocationHistory,
  testUserHistory
};
