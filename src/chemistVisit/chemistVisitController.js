const Chemist = require('../chemist/Chemist');
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

// GET all chemist visits
const getAllChemistVisits = async (req, res) => {
  try {
    const { ChemistVisit, User, Sequelize } = req.app.get('models');
    const { Op } = Sequelize;
    const { startDate, endDate, range } = req.query;

    let whereClause = {};
    const today = new Date().toISOString().split('T')[0];

    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (range === 'last7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      whereClause.date = { [Op.between]: [d.toISOString().split('T')[0], today] };
    } else if (range === 'last30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      whereClause.date = { [Op.between]: [d.toISOString().split('T')[0], today] };
    } else if (range === 'upcoming') {
      whereClause.date = { [Op.gt]: today };
    } else if (range === 'all') {
      // No date filter
    } else {
      // Default to today
      whereClause.date = today;
    }

    const chemistVisits = await ChemistVisit.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          where: { is_active: true },
          attributes: ['id', 'name', 'email', 'employee_code', 'is_active']
        }
      ]
    });
    res.json({
      success: true,
      count: chemistVisits.length,
      data: chemistVisits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET chemist visit by ID
const getChemistVisitById = async (req, res) => {
  try {
    const { ChemistVisit } = req.app.get('models'); // Get ChemistVisit model from app context
    const chemistVisit = await ChemistVisit.findByPk(req.params.id);
    if (!chemistVisit) {
      return res.status(404).json({
        success: false,
        message: 'Chemist visit not found'
      });
    }
    res.json({
      success: true,
      data: chemistVisit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new chemist visit
const createChemistVisit = async (req, res) => {
  try {
    const { ChemistVisit, Chemist, User } = req.app.get('models'); // Get models from app context
    const { chemist_id, user_id, date, notes } = req.body;

    // Validate chemist exists
    const chemist = await Chemist.findByPk(chemist_id);
    if (!chemist) {
      return res.status(404).json({
        success: false,
        message: 'Chemist not found'
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

    const chemistVisit = await ChemistVisit.create({
      chemist_id,
      user_id,
      date,
      notes
    });

    res.status(201).json({
      success: true,
      data: chemistVisit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a chemist visit
const updateChemistVisit = async (req, res) => {
  try {
    const { ChemistVisit } = req.app.get('models'); // Get ChemistVisit model from app context
    const chemistVisit = await ChemistVisit.findByPk(req.params.id);
    if (!chemistVisit) {
      return res.status(404).json({
        success: false,
        message: 'Chemist visit not found'
      });
    }

    await chemistVisit.update(req.body);
    res.json({
      success: true,
      data: chemistVisit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a chemist visit
const deleteChemistVisit = async (req, res) => {
  try {
    const { ChemistVisit } = req.app.get('models'); // Get ChemistVisit model from app context
    const chemistVisit = await ChemistVisit.findByPk(req.params.id);
    if (!chemistVisit) {
      return res.status(404).json({
        success: false,
        message: 'Chemist visit not found'
      });
    }

    await chemistVisit.destroy();
    res.json({
      success: true,
      message: 'Chemist visit deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CONFIRM a chemist visit
const confirmChemistVisit = async (req, res) => {
  try {
    const { ChemistVisit, Chemist } = req.app.get('models'); // Get models from app context
    const { id } = req.params;
    let { userLatitude, userLongitude } = req.body;

    const visit = await ChemistVisit.findByPk(id, {
      include: [{
        model: Chemist,
        as: 'Chemist'
      }]
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Get chemist information
    const chemist = visit.Chemist;
    if (!chemist) {
      return res.status(404).json({
        success: false,
        message: 'Chemist not found'
      });
    }

    // Check if chemist's location is available for distance calculation
    if (chemist.latitude && chemist.longitude) {
      // Calculate distance
      const distance = getDistance(
        userLatitude,
        userLongitude,
        chemist.latitude,
        chemist.longitude
      );

      // Check if distance is within 200 meters
      if (distance > 200) {
        return res.status(200).json({
          status: false,
          success: false,
          message: `You are ${Math.round(distance)} meters away from the chemist's location. Please be within 200 meters to confirm the visit.`,
          distance: Math.round(distance)
        });
      }
    } else {
      // Log that chemist's location is not available, but proceed with confirmation
      console.log(`Chemist ${chemist.id} has no location data. Skipping distance check.`);
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
const getChemistVisitsByUserId = async (req, res) => {
  try {
    const { ChemistVisit, Chemist, Sequelize } = req.app.get('models');
    const { Op } = Sequelize;
    const { userId } = req.params;
    const { startDate, endDate, range } = req.query;

    let whereClause = { user_id: userId };
    const today = new Date().toISOString().split('T')[0];

    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (range === 'last7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      whereClause.date = { [Op.between]: [d.toISOString().split('T')[0], today] };
    } else if (range === 'last30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      whereClause.date = { [Op.between]: [d.toISOString().split('T')[0], today] };
    } else if (range === 'upcoming') {
      whereClause.date = { [Op.gt]: today };
    } else if (range === 'all') {
      // No date filter
    } else {
      // Default to today
      whereClause.date = today;
    }

    const visits = await ChemistVisit.findAll({
      where: whereClause,
      include: [{
        model: Chemist,
        as: 'Chemist'
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
  getAllChemistVisits,
  getChemistVisitById,
  createChemistVisit,
  updateChemistVisit,
  deleteChemistVisit,
  confirmChemistVisit,
  getChemistVisitsByUserId
};