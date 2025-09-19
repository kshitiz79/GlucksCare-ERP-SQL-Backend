const { Op } = require('sequelize');

// GET all shifts
const getAllShifts = async (req, res) => {
  try {
    const { Shift } = req.app.get('models');
    const shifts = await Shift.findAll({
      include: [
        {
          model: req.app.get('models').UserShift,
          as: 'userShifts',
          include: [
            {
              model: req.app.get('models').User,
              as: 'user',
              attributes: ['id', 'name', 'employee_code']
            }
          ]
        }
      ]
    });

    // Format response to match frontend expectations
    const formattedShifts = shifts.map(shift => ({
      id: shift.id,
      name: shift.name,
      description: shift.description,
      startTime: shift.start_time,
      endTime: shift.end_time,
      workDays: shift.work_days,
      breakDuration: shift.break_duration,
      isActive: shift.is_active,
      assignedUsers: shift.userShifts?.map(us => us.user?.id) || []
    }));

    res.json({
      success: true,
      count: formattedShifts.length,
      data: formattedShifts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET users available for shift assignment
const getUsersForShiftAssignment = async (req, res) => {
  try {
    const { search = '' } = req.query;

    const users = await req.app.get('models').User.findAll({
      where: {
        is_active: true,
        ...(search && {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { employee_code: { [Op.iLike]: `%${search}%` } },
            { role: { [Op.iLike]: `%${search}%` } }
          ]
        })
      },
      attributes: ['id', 'name', 'employee_code', 'role', 'is_active', 'email'],
      limit: 100
    });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Assign users to shift
const assignUsersToShift = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { userIds } = req.body;

    // Verify shift exists
    const { Shift } = req.app.get('models');
    const shift = await Shift.findByPk(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Remove existing assignments for this shift
    await req.app.get('models').UserShift.destroy({
      where: { shift_id: shiftId }
    });

    // Create new assignments
    if (userIds && userIds.length > 0) {
      const assignments = userIds.map(userId => ({
        user_id: userId,
        shift_id: shiftId
      }));

      await req.app.get('models').UserShift.bulkCreate(assignments);
    }

    res.json({
      success: true,
      message: `Successfully assigned ${userIds?.length || 0} users to shift`,
      data: {
        shiftId,
        assignedUserCount: userIds?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET shift by ID
const getShiftById = async (req, res) => {
  try {
    const { Shift } = req.app.get('models');
    const shift = await Shift.findByPk(req.params.id, {
      include: [
        {
          model: req.app.get('models').UserShift,
          as: 'userShifts',
          include: [
            {
              model: req.app.get('models').User,
              as: 'user',
              attributes: ['id', 'name', 'employee_code']
            }
          ]
        }
      ]
    });
    
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Format response to match frontend expectations
    const formattedShift = {
      id: shift.id,
      name: shift.name,
      description: shift.description,
      startTime: shift.start_time,
      endTime: shift.end_time,
      workDays: shift.work_days,
      breakDuration: shift.break_duration,
      isActive: shift.is_active,
      assignedUsers: shift.userShifts?.map(us => us.user?.id) || []
    };

    res.json({
      success: true,
      data: formattedShift
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new shift
const createShift = async (req, res) => {
  try {
    const { Shift } = req.app.get('models');
    
    // Map frontend field names to database field names
    const shiftData = {
      name: req.body.name,
      description: req.body.description,
      start_time: req.body.startTime || req.body.start_time,
      end_time: req.body.endTime || req.body.end_time,
      work_days: req.body.workDays || req.body.work_days,
      break_duration: req.body.breakDuration || req.body.break_duration || 60,
      grace_period: req.body.gracePeriod || req.body.grace_period || 15,
      minimum_hours: req.body.minimumHours || req.body.minimum_hours || 8.0,
      half_day_threshold: req.body.halfDayThreshold || req.body.half_day_threshold || 4.0,
      overtime_enabled: req.body.overtimeEnabled !== undefined ? req.body.overtimeEnabled : (req.body.overtime_enabled !== undefined ? req.body.overtime_enabled : true),
      overtime_threshold: req.body.overtimeThreshold || req.body.overtime_threshold || 8.0,
      location_restricted: req.body.locationRestricted !== undefined ? req.body.locationRestricted : (req.body.location_restricted !== undefined ? req.body.location_restricted : false),
      allowed_locations: req.body.allowedLocations || req.body.allowed_locations,
      is_active: req.body.isActive !== undefined ? req.body.isActive : (req.body.is_active !== undefined ? req.body.is_active : true)
    };
    
    const shift = await Shift.create(shiftData);
    res.status(201).json({
      success: true,
      data: shift
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a shift
const updateShift = async (req, res) => {
  try {
    const { Shift } = req.app.get('models');
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    // Map frontend field names to database field names
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      start_time: req.body.startTime || req.body.start_time,
      end_time: req.body.endTime || req.body.end_time,
      work_days: req.body.workDays || req.body.work_days,
      break_duration: req.body.breakDuration || req.body.break_duration,
      grace_period: req.body.gracePeriod || req.body.grace_period,
      minimum_hours: req.body.minimumHours || req.body.minimum_hours,
      half_day_threshold: req.body.halfDayThreshold || req.body.half_day_threshold,
      overtime_enabled: req.body.overtimeEnabled !== undefined ? req.body.overtimeEnabled : req.body.overtime_enabled,
      overtime_threshold: req.body.overtimeThreshold || req.body.overtime_threshold,
      location_restricted: req.body.locationRestricted !== undefined ? req.body.locationRestricted : req.body.location_restricted,
      allowed_locations: req.body.allowedLocations || req.body.allowed_locations,
      is_active: req.body.isActive !== undefined ? req.body.isActive : req.body.is_active
    };

    await shift.update(updateData);
    res.json({
      success: true,
      data: shift
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a shift
const deleteShift = async (req, res) => {
  try {
    const { Shift } = req.app.get('models');
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    await shift.destroy();
    res.json({
      success: true,
      message: 'Shift deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  getUsersForShiftAssignment,
  assignUsersToShift
};