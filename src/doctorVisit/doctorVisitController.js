const Doctor = require('../doctor/Doctor');
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

// GET all doctor visits
const getAllDoctorVisits = async (req, res) => {
  try {
    const { DoctorVisit, Doctor, User, Product } = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { Op } = require('sequelize');
    const { startDate, endDate, range } = req.query;

    let whereClause = {};
    const today = new Date().toISOString().split('T')[0];

    // Apply date filters only if explicitly requested
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
    } else if (range === 'today') {
      whereClause.date = today;
    }
    // Default: No date filter - returns all visits

    const doctorVisits = await DoctorVisit.findAll({
      where: whereClause,
      include: [
        {
          model: Doctor,
          as: 'DoctorInfo',
          attributes: ['id', 'name', 'specialization', 'areaId', 'headOfficeId']
        },
        {
          model: User,
          as: 'UserInfo',
          where: { is_active: true }, // Only include visits from active users
          attributes: ['id', 'name', 'email', 'is_active']
        },
        {
          model: Product,
          as: 'ProductInfo',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });

    // Transform the response to match the expected format
    const transformedVisits = doctorVisits.map(visit => {
      const visitObj = visit.toJSON();
      return {
        ...visitObj,
        doctor: visitObj.DoctorInfo || null,
        user: visitObj.UserInfo || null,
        product: visitObj.ProductInfo || null,
        // Remove the nested objects
        DoctorInfo: undefined,
        UserInfo: undefined,
        ProductInfo: undefined
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

// GET doctor visit by ID or all visits for a user
const getDoctorVisitById = async (req, res) => {
  try {
    const { DoctorVisit, Doctor, User, Product } = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { Op } = require('sequelize');
    const { id } = req.params;
    const { startDate, endDate, range } = req.query;

    console.log('🔍 Searching for visit or user with ID:', id);

    // First, try to find a single visit by ID
    const doctorVisit = await DoctorVisit.findByPk(id, {
      include: [
        {
          model: Doctor,
          as: 'DoctorInfo',
          attributes: ['id', 'name', 'specialization', 'areaId'],
          required: false
        },
        {
          model: User,
          as: 'UserInfo',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: Product,
          as: 'ProductInfo',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });

    // If found as a visit ID, return the single visit as an array
    if (doctorVisit) {
      console.log('✅ Found visit by ID');
      const visitObj = doctorVisit.toJSON();
      return res.json({
        data: [{
          ...visitObj,
          doctor: visitObj.DoctorInfo || null,
          user: visitObj.UserInfo || null,
          product: visitObj.ProductInfo || null,
          DoctorInfo: undefined,
          UserInfo: undefined,
          ProductInfo: undefined
        }],
        count: 1,
        type: 'single_visit'
      });
    }

    // If not found as visit ID, try to find visits by user_id
    console.log('🔍 Not found as visit ID, checking if it\'s a user_id...');

    let whereClause = { user_id: id };
    const today = new Date().toISOString().split('T')[0];

    // Apply date filters only if explicitly requested
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
    } else if (range === 'today') {
      whereClause.date = today;
    }
    // Default: No date filter - returns all visits

    const visits = await DoctorVisit.findAll({
      where: whereClause,
      include: [
        {
          model: Doctor,
          as: 'DoctorInfo',
          attributes: ['id', 'name', 'specialization', 'areaId'],
          required: false
        },
        {
          model: User,
          as: 'UserInfo',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: Product,
          as: 'ProductInfo',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [['date', 'DESC']]
    });

    // If found visits for user_id, return them
    if (visits.length > 0) {
      console.log(`✅ Found ${visits.length} visits for user_id: ${id}`);

      const transformedVisits = visits.map(visit => {
        const visitObj = visit.toJSON();
        return {
          ...visitObj,
          doctor: visitObj.DoctorInfo || null,
          user: visitObj.UserInfo || null,
          product: visitObj.ProductInfo || null,
          DoctorInfo: undefined,
          UserInfo: undefined,
          ProductInfo: undefined
        };
      });

      return res.json({
        data: transformedVisits,
        count: transformedVisits.length,
        type: 'user_visits' // Indicate this is a list of visits for a user
      });
    }

    // If neither visit ID nor user_id found, return 404
    console.log('❌ No visit or user visits found for ID:', id);
    return res.status(404).json({
      success: false,
      message: 'No visit found with this ID, and no visits found for this user ID'
    });

  } catch (error) {
    console.error('❌ Error in getDoctorVisitById:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// CREATE a new doctor visit
const createDoctorVisit = async (req, res) => {
  try {
    const { DoctorVisit, Doctor, User } = req.app.get('models'); // Get models from app context
    const { doctor_id, user_id, date, notes, product_id, remark } = req.body;

    // Validate doctor exists
    const doctor = await Doctor.findByPk(doctor_id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
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

    // Validate if an unconfirmed visit exists for this doctor on the same day
    const existingUnconfirmedVisit = await DoctorVisit.findOne({
      where: {
        doctor_id,
        date,
        confirmed: false
      }
    });

    if (existingUnconfirmedVisit) {
      return res.status(400).json({
        success: false,
        message: 'An unconfirmed visit for this doctor already exists on this date.'
      });
    }

    const doctorVisit = await DoctorVisit.create({
      doctor_id,
      user_id,
      date,
      notes,
      product_id: product_id || null,
      remark: remark || null
    });

    res.status(201).json({
      success: true,
      data: doctorVisit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a doctor visit
const updateDoctorVisit = async (req, res) => {
  try {
    const { DoctorVisit } = req.app.get('models'); // Get DoctorVisit model from app context
    const doctorVisit = await DoctorVisit.findByPk(req.params.id);
    if (!doctorVisit) {
      return res.status(404).json({
        success: false,
        message: 'Doctor visit not found'
      });
    }

    await doctorVisit.update(req.body);
    res.json({
      success: true,
      data: doctorVisit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a doctor visit
const deleteDoctorVisit = async (req, res) => {
  try {
    const { DoctorVisit } = req.app.get('models'); // Get DoctorVisit model from app context
    const doctorVisit = await DoctorVisit.findByPk(req.params.id);
    if (!doctorVisit) {
      return res.status(404).json({
        success: false,
        message: 'Doctor visit not found'
      });
    }

    await doctorVisit.destroy();
    res.json({
      success: true,
      message: 'Doctor visit deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CONFIRM a doctor visit
const confirmDoctorVisit = async (req, res) => {
  try {
    const { DoctorVisit, Product, Doctor, UserInventory } = req.app.get('models'); // Get models from app context
    const sequelize = req.app.get('sequelize');
    const { id } = req.params;
    let { userLatitude, userLongitude, product_id, products_detailed, productIds, gifts_given, remark, notes } = req.body;
    
    // We will wrap the updates in a transaction if there are gifts to deduct
    const transaction = gifts_given && gifts_given.length > 0 ? await sequelize.transaction() : null;

    const visit = await DoctorVisit.findByPk(id, {
      include: [{
        model: Doctor,
        as: 'DoctorInfo'
      }]
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Get doctor information
    const doctor = visit.DoctorInfo;
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }


    // Check if doctor's location is available for distance calculation
    if (doctor.latitude && doctor.longitude) {
      // Calculate distance
      const distance = getDistance(
        userLatitude,
        userLongitude,
        doctor.latitude,
        doctor.longitude
      );

      // Check if distance is within 200 meters
      if (distance > 200) {
        return res.status(200).json({
          status: false,
          success: false,
          message: `You are ${Math.round(distance)} meters away from the doctor's location. Please be within 200 meters to confirm the visit.`,
          distance: Math.round(distance)
        });
      }
    } else {
      // Log that doctor's location is not available, but proceed with confirmation
      console.log(`Doctor ${doctor.id} has no location data. Skipping distance check.`);
    }

    // Validate product if provided
    if (product_id) {
      const product = await Product.findByPk(product_id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      visit.product_id = product_id;
    }

    // Update remark if provided
    if (remark !== undefined) {
      visit.remark = remark;
    }

    // Update notes if provided
    if (notes !== undefined) {
      visit.notes = notes;
    }

    // Validate and process multiple products
    if (products_detailed && Array.isArray(products_detailed)) {
      visit.products_detailed = products_detailed;
    }

    // Process productIds if provided
    if (productIds && Array.isArray(productIds)) {
      visit.products_detailed = productIds.map(pid => {
        if (typeof pid === 'object' && pid !== null) {
          return { product_id: pid.product_id || pid.id || pid };
        }
        return { product_id: pid };
      });
    }

    // Process gifts
    if (gifts_given && Array.isArray(gifts_given) && gifts_given.length > 0) {
      for (const gift of gifts_given) {
        if (!gift.item_id || !gift.quantity || gift.quantity <= 0) continue;
        
        let userInv = await UserInventory.findOne({
          where: { user_id: visit.user_id, inventory_item_id: gift.item_id },
          transaction
        });
        
        if (!userInv || userInv.assigned_stock < gift.quantity) {
          if (transaction) await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Not enough stock for gift item ID ${gift.item_id}`
          });
        }
        
        userInv.assigned_stock -= gift.quantity;
        await userInv.save({ transaction });
      }
      visit.gifts_given = gifts_given;
    }

    // Confirm the visit and save user's location
    visit.confirmed = true;
    visit.latitude = userLatitude || null;
    visit.longitude = userLongitude || null;

    if (transaction) {
      await visit.save({ transaction });
      await transaction.commit();
    } else {
      await visit.save();
    }

    res.status(200).json({
      status: true,
      success: true,
      message: 'Visit confirmed successfully',
      visit: visit
    });
  } catch (error) {
    if (typeof transaction !== 'undefined' && transaction) {
       try { await transaction.rollback(); } catch(e) {}
    }
    console.error('Confirm visit error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET visits by user ID
const getDoctorVisitsByUserId = async (req, res) => {
  try {
    const { DoctorVisit, Doctor, User, Product } = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { Op } = require('sequelize');
    const { userId } = req.params;
    const { startDate, endDate, range } = req.query;

    // Log the request for debugging
    console.log('📋 Fetching doctor visits for user:', userId);
    console.log('📅 Query params:', { startDate, endDate, range });

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    let whereClause = { user_id: userId };
    const today = new Date().toISOString().split('T')[0];

    // Compute start and end dates for auto-scheduling
    let start = startDate || today;
    let end = endDate || today;

    // Apply date filters only if explicitly requested
    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (range === 'last7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
      end = today;
      whereClause.date = { [Op.between]: [start, today] };
    } else if (range === 'last30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
      end = today;
      whereClause.date = { [Op.between]: [start, today] };
    } else if (range === 'upcoming') {
      const d = new Date();
      d.setDate(d.getDate() + 14); // auto-schedule upcoming 14 days
      start = today;
      end = d.toISOString().split('T')[0];
      whereClause.date = { [Op.gt]: today };
    } else if (range === 'today') {
      start = today;
      end = today;
      whereClause.date = today;
    }

    // Trigger auto-scheduling of doctor visits
    try {
      const { autoScheduleVisits } = require('../utils/autoScheduler');
      const models = req.app.get('models');
      await autoScheduleVisits(sequelize, models, userId, start, end, 'doctor');
    } catch (schedErr) {
      console.error('Failed to run auto-scheduler for doctor visits:', schedErr);
    }

    console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));

    const visits = await DoctorVisit.findAll({
      where: whereClause,
      include: [
        {
          model: Doctor,
          as: 'DoctorInfo',
          attributes: ['id', 'name', 'specialization', 'geo_image_url', 'areaId', 'headOfficeId'],
          required: false // Use LEFT JOIN instead of INNER JOIN
        },
        {
          model: User,
          as: 'UserInfo',
          attributes: ['id', 'name', 'email'],
          required: false // Use LEFT JOIN instead of INNER JOIN
        },
        {
          model: Product,
          as: 'ProductInfo',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [
        ['created_at', 'DESC'], // Sort by creation timestamp descending (most recent first)
        ['date', 'DESC']        // Secondary sort by date descending
      ]
    });

    console.log(`✅ Found ${visits.length} visits for user ${userId}`);

    // If no visits found, return empty array
    if (visits.length === 0) {
      console.log('⚠️ No visits found, returning empty array');
      return res.json([]);
    }

    const transformedVisits = visits.map(visit => {
      const visitObj = visit.toJSON();
      return {
        ...visitObj,
        headOfficeId: visitObj.DoctorInfo ? (visitObj.DoctorInfo.headOfficeId || visitObj.DoctorInfo.head_office_id) : null,
        head_office_id: visitObj.DoctorInfo ? (visitObj.DoctorInfo.headOfficeId || visitObj.DoctorInfo.head_office_id) : null,
        doctor: visitObj.DoctorInfo ? {
          ...visitObj.DoctorInfo,
          geo_image_status: !!visitObj.DoctorInfo.geo_image_url,
          geo_image_url: undefined // Remove URL from response
        } : null,
        user: visitObj.UserInfo || null,
        product: visitObj.ProductInfo || null,
        DoctorInfo: undefined,
        UserInfo: undefined,
        ProductInfo: undefined
      };
    });

    // Return plain array for frontend compatibility
    res.json(transformedVisits);
  } catch (error) {
    console.error('❌ Error in getDoctorVisitsByUserId:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const bulkConfirmDoctorVisits = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { DoctorVisit, Product, Doctor, UserInventory } = req.app.get('models');
    const { visitIds, visits, userLatitude, userLongitude, notes, remark, productIds, products_detailed, gifts_given } = req.body;

    let itemsToProcess = [];

    if (Array.isArray(visitIds)) {
      itemsToProcess = visitIds.map(id => ({
        id,
        userLatitude,
        userLongitude,
        notes,
        remark,
        productIds,
        products_detailed,
        gifts_given
      }));
    } else if (Array.isArray(visits)) {
      itemsToProcess = visits.map(item => ({
        ...item,
        userLatitude: item.userLatitude !== undefined ? item.userLatitude : userLatitude,
        userLongitude: item.userLongitude !== undefined ? item.userLongitude : userLongitude,
        notes: item.notes !== undefined ? item.notes : notes,
        remark: item.remark !== undefined ? item.remark : remark,
        productIds: item.productIds !== undefined ? item.productIds : productIds,
        products_detailed: item.products_detailed !== undefined ? item.products_detailed : products_detailed,
        gifts_given: item.gifts_given !== undefined ? item.gifts_given : gifts_given
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
      const { userLatitude, userLongitude, product_id, products_detailed, productIds, gifts_given, remark, notes } = item;

      const visit = await DoctorVisit.findByPk(visitId, {
        include: [{
          model: Doctor,
          as: 'DoctorInfo'
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

      const doctor = visit.DoctorInfo;
      if (doctor && doctor.latitude && doctor.longitude && userLatitude && userLongitude) {
        const distance = getDistance(
          userLatitude,
          userLongitude,
          doctor.latitude,
          doctor.longitude
        );

        if (distance > 200) {
          errors.push({
            id: visitId,
            message: `You are ${Math.round(distance)} meters away from the doctor's location. Please be within 200 meters.`
          });
          continue;
        }
      }

      if (product_id) {
        const product = await Product.findByPk(product_id, { transaction });
        if (!product) {
          errors.push({ id: visitId, message: `Product ID ${product_id} not found` });
          continue;
        }
        visit.product_id = product_id;
      }

      if (remark !== undefined) {
        visit.remark = remark;
      }

      if (notes !== undefined) {
        visit.notes = notes;
      }

      if (products_detailed && Array.isArray(products_detailed)) {
        visit.products_detailed = products_detailed;
      }

      if (productIds && Array.isArray(productIds)) {
        visit.products_detailed = productIds.map(pid => {
          if (typeof pid === 'object' && pid !== null) {
            return { product_id: pid.product_id || pid.id || pid };
          }
          return { product_id: pid };
        });
      }

      let giftError = false;
      if (gifts_given && Array.isArray(gifts_given) && gifts_given.length > 0) {
        for (const gift of gifts_given) {
          if (!gift.item_id || !gift.quantity || gift.quantity <= 0) continue;

          const userInv = await UserInventory.findOne({
            where: { user_id: visit.user_id, inventory_item_id: gift.item_id },
            transaction
          });

          if (!userInv || userInv.assigned_stock < gift.quantity) {
            errors.push({ id: visitId, message: `Not enough stock for gift item ID ${gift.item_id}` });
            giftError = true;
            break;
          }

          userInv.assigned_stock -= gift.quantity;
          await userInv.save({ transaction });
        }
        if (!giftError) {
          visit.gifts_given = gifts_given;
        }
      }

      if (giftError) {
        continue;
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
    console.error('Bulk confirm visits error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in bulk confirmation',
      error: error.message
    });
  }
};

module.exports = {
  getAllDoctorVisits,
  getDoctorVisitById,
  createDoctorVisit,
  updateDoctorVisit,
  deleteDoctorVisit,
  confirmDoctorVisit,
  getDoctorVisitsByUserId,
  bulkConfirmDoctorVisits
};