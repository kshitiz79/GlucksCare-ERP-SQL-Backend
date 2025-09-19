// Holiday Controller - PostgreSQL version adapted from MongoDB
const { Op } = require('sequelize');

/**
 * Get all holidays
 * GET /api/holidays
 */
const getAllHolidays = async (req, res) => {
  try {
    const { Holiday, User } = req.app.get('models');
    const { 
      year, 
      month, 
      type, 
      startDate, 
      endDate, 
      isActive 
    } = req.query;
    
    let whereClause = {};
    
    if (isActive !== undefined) {
      whereClause.is_active = isActive === 'true';
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    // Date filtering
    if (year) {
      const startOfYear = new Date(parseInt(year), 0, 1);
      const endOfYear = new Date(parseInt(year), 11, 31);
      whereClause.date = { [Op.between]: [startOfYear, endOfYear] };
    } else if (month && year) {
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
      whereClause.date = { [Op.between]: [startOfMonth, endOfMonth] };
    } else if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    const holidays = await Holiday.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'Updater',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['date', 'ASC']]
    });
    
    res.json({
      success: true,
      data: holidays
    });
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Get holiday by ID
 * GET /api/holidays/:id
 */
const getHolidayById = async (req, res) => {
  try {
    const { Holiday, User } = req.app.get('models');
    
    const holiday = await Holiday.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'Updater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    res.json({
      success: true,
      data: holiday
    });
  } catch (error) {
    console.error('Get holiday by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Create new holiday
 * POST /api/holidays
 */
const createHoliday = async (req, res) => {
  try {
    const { Holiday } = req.app.get('models');
    
    // Only Admin and Super Admin can create holidays
    if (!['Admin', 'Super Admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admin can create holidays'
      });
    }
    
    const holidayData = {
      ...req.body,
      created_by: req.user.id
    };
    
    // Handle empty string for recurring_type - convert to null
    if (holidayData.recurringType === '' || holidayData.recurringType === null) {
      holidayData.recurring_type = null;
    } else {
      holidayData.recurring_type = holidayData.recurringType;
    }
    
    // If not recurring, ensure recurring_type is null
    if (!holidayData.isRecurring) {
      holidayData.recurring_type = null;
    }
    
    // Map frontend field names to database field names
    holidayData.is_recurring = holidayData.isRecurring;
    holidayData.is_optional = holidayData.isOptional;
    holidayData.max_optional_takers = holidayData.maxOptionalTakers;
    holidayData.is_active = holidayData.isActive !== undefined ? holidayData.isActive : true;
    holidayData.applicable_states = holidayData.applicableStates || [];
    holidayData.applicable_roles = holidayData.applicableRoles || [];
    
    const holiday = await Holiday.create(holidayData);
    
    // Fetch the created holiday with associations
    const populatedHoliday = await Holiday.findByPk(holiday.id, {
      include: [
        {
          model: req.app.get('models').User,
          as: 'Creator',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    
    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      data: populatedHoliday
    });
  } catch (error) {
    console.error('Create holiday error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Update holiday
 * PUT /api/holidays/:id
 */
const updateHoliday = async (req, res) => {
  try {
    const { Holiday, User } = req.app.get('models');
    
    // Only Admin and Super Admin can update holidays
    if (!['Admin', 'Super Admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admin can update holidays'
      });
    }
    
    const updateData = {
      ...req.body,
      updated_by: req.user.id
    };
    
    // Handle empty string for recurring_type - convert to null
    if (updateData.recurringType === '' || updateData.recurringType === null) {
      updateData.recurring_type = null;
    } else {
      updateData.recurring_type = updateData.recurringType;
    }
    
    // If not recurring, ensure recurring_type is null
    if (!updateData.isRecurring) {
      updateData.recurring_type = null;
    }
    
    // Map frontend field names to database field names
    if (updateData.isRecurring !== undefined) updateData.is_recurring = updateData.isRecurring;
    if (updateData.isOptional !== undefined) updateData.is_optional = updateData.isOptional;
    if (updateData.maxOptionalTakers !== undefined) updateData.max_optional_takers = updateData.maxOptionalTakers;
    if (updateData.isActive !== undefined) updateData.is_active = updateData.isActive;
    if (updateData.applicableStates !== undefined) updateData.applicable_states = updateData.applicableStates;
    if (updateData.applicableRoles !== undefined) updateData.applicable_roles = updateData.applicableRoles;
    
    const [updatedCount] = await Holiday.update(updateData, {
      where: { id: req.params.id }
    });
    
    if (updatedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    const holiday = await Holiday.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'Updater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    
    res.json({
      success: true,
      message: 'Holiday updated successfully',
      data: holiday
    });
  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Delete holiday
 * DELETE /api/holidays/:id
 */
const deleteHoliday = async (req, res) => {
  try {
    const { Holiday } = req.app.get('models');
    
    // Only Admin and Super Admin can delete holidays
    if (!['Admin', 'Super Admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admin can delete holidays'
      });
    }
    
    const deletedCount = await Holiday.destroy({
      where: { id: req.params.id }
    });
    
    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Holiday deleted successfully'
    });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Get holidays for calendar view
 * GET /api/holidays/calendar
 */
const getHolidaysForCalendar = async (req, res) => {
  try {
    const { Holiday } = req.app.get('models');
    const { 
      year = new Date().getFullYear(),
      userState,
      userRole,
      type
    } = req.query;
    
    const startOfYear = new Date(parseInt(year), 0, 1);
    const endOfYear = new Date(parseInt(year), 11, 31);
    
    let whereClause = {
      date: {
        [Op.between]: [startOfYear, endOfYear]
      },
      is_active: true
    };
    
    // Add type filter if provided
    if (type) {
      whereClause.type = type;
    }
    
    // Add state filter if provided
    if (userState) {
      whereClause[Op.or] = [
        { applicable_states: { [Op.eq]: [] } }, // No specific states (applies to all)
        { applicable_states: { [Op.contains]: [userState] } }
      ];
    }
    
    // Add role filter if provided
    if (userRole) {
      const orConditions = whereClause[Op.or] || [];
      orConditions.push(
        { applicable_roles: { [Op.eq]: [] } }, // No specific roles (applies to all)
        { applicable_roles: { [Op.contains]: [userRole] } }
      );
      whereClause[Op.or] = orConditions;
    }
    
    const holidays = await Holiday.findAll({
      where: whereClause,
      order: [['date', 'ASC']]
    });
    
    // Format for calendar
    const calendarEvents = holidays.map(holiday => ({
      id: holiday.id,
      title: holiday.name,
      date: holiday.date,
      type: holiday.type,
      description: holiday.description,
      color: holiday.color,
      isOptional: holiday.is_optional,
      isRecurring: holiday.is_recurring
    }));
    
    res.json({
      success: true,
      data: calendarEvents
    });
  } catch (error) {
    console.error('Get holidays for calendar error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Get current user info (for debugging)
 * GET /api/holidays/debug/user
 */
const getCurrentUser = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Check if date is holiday
 * GET /api/holidays/check/:date
 */
const checkHoliday = async (req, res) => {
  try {
    const { Holiday } = req.app.get('models');
    const { date } = req.params;
    const { userState, userRole } = req.query;
    
    const checkDate = new Date(date);
    const startOfDay = new Date(checkDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(checkDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    let whereClause = {
      date: {
        [Op.between]: [startOfDay, endOfDay]
      },
      is_active: true
    };
    
    // Add state filter if provided
    if (userState) {
      whereClause[Op.or] = [
        { applicable_states: { [Op.eq]: [] } }, // No specific states (applies to all)
        { applicable_states: { [Op.contains]: [userState] } }
      ];
    }
    
    // Add role filter if provided
    if (userRole) {
      const orConditions = whereClause[Op.or] || [];
      orConditions.push(
        { applicable_roles: { [Op.eq]: [] } }, // No specific roles (applies to all)
        { applicable_roles: { [Op.contains]: [userRole] } }
      );
      whereClause[Op.or] = orConditions;
    }
    
    const holidays = await Holiday.findAll({
      where: whereClause
    });
    
    res.json({
      success: true,
      data: {
        date,
        isHoliday: holidays.length > 0,
        holidays: holidays.map(h => ({
          id: h.id,
          name: h.name,
          type: h.type,
          isOptional: h.is_optional
        }))
      }
    });
  } catch (error) {
    console.error('Check holiday error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = {
  getAllHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getHolidaysForCalendar,
  checkHoliday,
  getCurrentUser
};