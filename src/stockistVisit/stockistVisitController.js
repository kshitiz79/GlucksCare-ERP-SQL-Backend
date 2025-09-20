const Stockist = require('../stockist/Stockist');
const User = require('../user/User');

// Haversine formula for distance calculation
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

// GET all stockist visits
const getAllStockistVisits = async (req, res) => {
  try {
    const { StockistVisit } = req.app.get('models'); // Get StockistVisit model from app context
    const stockistVisits = await StockistVisit.findAll();
    res.json({
      success: true,
      count: stockistVisits.length,
      data: stockistVisits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET stockist visit by ID
const getStockistVisitById = async (req, res) => {
  try {
    const { StockistVisit } = req.app.get('models'); // Get StockistVisit model from app context
    const stockistVisit = await StockistVisit.findByPk(req.params.id);
    if (!stockistVisit) {
      return res.status(404).json({
        success: false,
        message: 'Stockist visit not found'
      });
    }
    res.json({
      success: true,
      data: stockistVisit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new stockist visit
const createStockistVisit = async (req, res) => {
  try {
    const { StockistVisit, Stockist, User } = req.app.get('models'); // Get models from app context
    const { stockist_id, user_id, date, notes } = req.body;

    // Validate stockist exists
    const stockist = await Stockist.findByPk(stockist_id);
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }

    // Validate user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const stockistVisit = await StockistVisit.create({
      stockist_id,
      user_id,
      date,
      notes
    });

    res.status(201).json({
      success: true,
      data: stockistVisit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a stockist visit
const updateStockistVisit = async (req, res) => {
  try {
    const { StockistVisit } = req.app.get('models'); // Get StockistVisit model from app context
    const stockistVisit = await StockistVisit.findByPk(req.params.id);
    if (!stockistVisit) {
      return res.status(404).json({
        success: false,
        message: 'Stockist visit not found'
      });
    }
    
    await stockistVisit.update(req.body);
    res.json({
      success: true,
      data: stockistVisit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a stockist visit
const deleteStockistVisit = async (req, res) => {
  try {
    const { StockistVisit } = req.app.get('models'); // Get StockistVisit model from app context
    const stockistVisit = await StockistVisit.findByPk(req.params.id);
    if (!stockistVisit) {
      return res.status(404).json({
        success: false,
        message: 'Stockist visit not found'
      });
    }
    
    await stockistVisit.destroy();
    res.json({
      success: true,
      message: 'Stockist visit deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CONFIRM a stockist visit
const confirmStockistVisit = async (req, res) => {
  try {
    const { StockistVisit, Stockist } = req.app.get('models'); // Get models from app context
    const { id } = req.params;
    let { userLatitude, userLongitude } = req.body;

    const visit = await StockistVisit.findByPk(id, {
      include: [{
        model: Stockist,
        as: 'Stockist'
      }]
    });
    
    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Get stockist information
    const stockist = visit.Stockist;
    if (!stockist) {
      return res.status(404).json({
        success: false,
        message: 'Stockist not found'
      });
    }

    // Check if stockist's location is available for distance calculation
    if (stockist.latitude && stockist.longitude) {
      // Calculate distance
      const distance = getDistance(
        userLatitude,
        userLongitude,
        stockist.latitude,
        stockist.longitude
      );

      // Check if distance is within 200 meters
      if (distance > 200) {
        return res.status(200).json({
          status: false,
          success: false,
          message: `You are ${Math.round(distance)} meters away from the stockist's location. Please be within 200 meters to confirm the visit.`,
          distance: Math.round(distance)
        });
      }
    } else {
      // Log that stockist's location is not available, but proceed with confirmation
      console.log(`Stockist ${stockist.id} has no location data. Skipping distance check.`);
    }

    // Confirm the visit and save user's location
    visit.confirmed = true;
    visit.latitude = userLatitude || null;
    visit.longitude = userLongitude || null;
    
    await visit.save();

    res.status(200).json({
      status: true,
      success: true,
      message: 'Visit confirmed successfully',
      visit: visit
    });
  } catch (error) {
    console.error('Confirm visit error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET visits by user ID
const getStockistVisitsByUserId = async (req, res) => {
  try {
    const { StockistVisit, Stockist } = req.app.get('models'); // Get models from app context
    const { userId } = req.params;
    
    const visits = await StockistVisit.findAll({
      where: { user_id: userId },
      include: [{
        model: Stockist,
        as: 'stockist' // This should match the association name in your model
      }]
    });

    res.json(visits);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllStockistVisits,
  getStockistVisitById,
  createStockistVisit,
  updateStockistVisit,
  deleteStockistVisit,
  confirmStockistVisit,
  getStockistVisitsByUserId
};