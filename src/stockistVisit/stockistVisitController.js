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
    const { StockistVisit } = req.app.get('models');
    const { Op } = require('sequelize');
    const { startDate, endDate, range, all } = req.query;

    let whereClause = {};
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffsetMs);
    const formatYMD = (d) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const today = formatYMD(nowIST);
    const yesterdayDate = new Date(nowIST.getTime() - 24 * 60 * 60 * 1000);
    const yesterday = formatYMD(yesterdayDate);

    const activeRange = range || (!startDate && !endDate && all !== 'true' ? 'today' : null);

    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.date = startDate;
    } else if (activeRange === 'yesterday') {
      whereClause.date = yesterday;
    } else if (activeRange === 'today') {
      whereClause.date = today;
    } else if (activeRange === 'last7days' || activeRange === 'week' || activeRange === 'thisweek') {
      const d = new Date(nowIST.getTime() - 7 * 24 * 60 * 60 * 1000);
      whereClause.date = { [Op.between]: [formatYMD(d), today] };
    } else if (activeRange === 'last30days') {
      const d = new Date(nowIST.getTime() - 30 * 24 * 60 * 60 * 1000);
      whereClause.date = { [Op.between]: [formatYMD(d), today] };
    } else if (activeRange === 'month' || activeRange === 'thismonth') {
      const firstDay = `${nowIST.getUTCFullYear()}-${String(nowIST.getUTCMonth() + 1).padStart(2, '0')}-01`;
      whereClause.date = { [Op.between]: [firstDay, today] };
    } else if (activeRange === 'lastmonth') {
      const firstDayLastMonth = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth() - 1, 1));
      const lastDayLastMonth = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 0));
      whereClause.date = { [Op.between]: [formatYMD(firstDayLastMonth), formatYMD(lastDayLastMonth)] };
    } else if (activeRange === 'upcoming') {
      whereClause.date = { [Op.gt]: today };
    }

    const stockistVisits = await StockistVisit.findAll({
      where: whereClause,
      order: [['date', 'DESC'], ['created_at', 'DESC']]
    });

    res.json(stockistVisits);
  } catch (error) {
    console.error('Error fetching all stockist visits:', error);
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

    // Validate if an unconfirmed visit exists for this stockist on the same day
    const existingUnconfirmedVisit = await StockistVisit.findOne({
      where: {
        stockist_id,
        date,
        confirmed: false
      }
    });

    if (existingUnconfirmedVisit) {
      return res.status(400).json({
        success: false,
        message: 'An unconfirmed visit for this stockist already exists on this date.'
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
    let { userLatitude, userLongitude, notes } = req.body;

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

    // Update notes if provided
    if (notes !== undefined) {
      visit.notes = notes;
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
    const { StockistVisit, Stockist, User } = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { Op } = require('sequelize');
    const { userId } = req.params;
    const { startDate, endDate, range } = req.query;

    let whereClause = { user_id: userId };
    const now = new Date();
    const formatYMD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const today = formatYMD(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = formatYMD(yesterdayDate);

    // Compute start and end dates for auto-scheduling
    let start = startDate || today;
    let end = endDate || today;

    // Apply date filters only if explicitly requested
    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.date = startDate;
    } else if (range === 'yesterday') {
      whereClause.date = yesterday;
      start = yesterday;
      end = yesterday;
    } else if (range === 'today') {
      whereClause.date = today;
      start = today;
      end = today;
    } else if (range === 'last7days' || range === 'week' || range === 'thisweek') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = formatYMD(d);
      end = today;
      whereClause.date = { [Op.between]: [start, today] };
    } else if (range === 'last30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      start = formatYMD(d);
      end = today;
      whereClause.date = { [Op.between]: [start, today] };
    } else if (range === 'month' || range === 'thismonth') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      start = firstDay;
      end = today;
      whereClause.date = { [Op.between]: [firstDay, today] };
    } else if (range === 'lastmonth') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      start = formatYMD(firstDayLastMonth);
      end = formatYMD(lastDayLastMonth);
      whereClause.date = { [Op.between]: [start, end] };
    } else if (range === 'upcoming') {
      const d = new Date(now);
      d.setDate(d.getDate() + 14); // auto-schedule upcoming 14 days
      start = today;
      end = formatYMD(d);
      whereClause.date = { [Op.gt]: today };
    }

    // Trigger auto-scheduling of stockist visits asynchronously in background
    try {
      const { autoScheduleVisits } = require('../utils/autoScheduler');
      const models = req.app.get('models');
      autoScheduleVisits(sequelize, models, userId, start, end, 'stockist').catch(schedErr => {
        console.error('Failed to run auto-scheduler for stockist visits:', schedErr);
      });
    } catch (schedErr) {
      console.error('Failed to initiate auto-scheduler for stockist visits:', schedErr);
    }

    const visits = await StockistVisit.findAll({
      where: whereClause,
      include: [{
        model: Stockist,
        as: 'Stockist'
      }]
    });

    // Transform visits to add geo_image_status
    const transformedVisits = visits.map(visit => {
      const visitObj = visit.toJSON();
      return {
        ...visitObj,
        headOfficeId: visitObj.Stockist ? (visitObj.Stockist.head_office_id || visitObj.Stockist.headOfficeId) : null,
        head_office_id: visitObj.Stockist ? (visitObj.Stockist.head_office_id || visitObj.Stockist.headOfficeId) : null,
        Stockist: visitObj.Stockist ? {
          ...visitObj.Stockist,
          geo_image_status: !!visitObj.Stockist.geo_image_url,
          geo_image_url: undefined // Remove URL from response
        } : null
      };
    });

    res.json(transformedVisits);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const bulkConfirmStockistVisits = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { StockistVisit, Stockist } = req.app.get('models');
    const { visitIds, visits, userLatitude, userLongitude, notes } = req.body;

    let itemsToProcess = [];

    if (Array.isArray(visitIds)) {
      itemsToProcess = visitIds.map(id => ({
        id,
        userLatitude,
        userLongitude,
        notes
      }));
    } else if (Array.isArray(visits)) {
      itemsToProcess = visits.map(item => ({
        ...item,
        userLatitude: item.userLatitude !== undefined ? item.userLatitude : userLatitude,
        userLongitude: item.userLongitude !== undefined ? item.userLongitude : userLongitude,
        notes: item.notes !== undefined ? item.notes : notes
      }));
    } else {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid input format. Must provide visitIds (array of IDs) or visits (array of objects).'
      });
    }

    if (itemsToProcess.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No visits provided to confirm.'
      });
    }

    const results = [];
    const errors = [];

    for (const item of itemsToProcess) {
      const visitId = item.id;
      const { userLatitude, userLongitude, notes } = item;

      const visit = await StockistVisit.findByPk(visitId, {
        include: [{
          model: Stockist,
          as: 'Stockist'
        }],
        transaction
      });

      if (!visit) {
        errors.push({ id: visitId, message: 'Visit not found' });
        continue;
      }

      if (visit.confirmed) {
        results.push({ id: visitId, message: 'Already confirmed', visit });
        continue;
      }

      const stockist = visit.Stockist;
      if (stockist && stockist.latitude && stockist.longitude && userLatitude && userLongitude) {
        const distance = getDistance(
          userLatitude,
          userLongitude,
          stockist.latitude,
          stockist.longitude
        );

        if (distance > 200) {
          errors.push({
            id: visitId,
            message: `You are ${Math.round(distance)} meters away from the stockist's location. Please be within 200 meters.`
          });
          continue;
        }
      }

      if (notes !== undefined) {
        visit.notes = notes;
      }

      visit.confirmed = true;
      if (userLatitude) visit.latitude = userLatitude;
      if (userLongitude) visit.longitude = userLongitude;

      await visit.save({ transaction });
      results.push({ id: visitId, message: 'Confirmed successfully', visit });
    }

    if (errors.length > 0 && results.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'All bulk confirmations failed.',
        errors
      });
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Processed bulk confirmation: ${results.length} succeeded, ${errors.length} failed.`,
      results,
      errors
    });

  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (e) {}
    }
    console.error('Bulk confirm stockist visits error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in bulk confirmation',
      error: error.message
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
  getStockistVisitsByUserId,
  bulkConfirmStockistVisits
};