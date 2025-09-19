const { Op } = require('sequelize');

// GET all leaves
const getAllLeaves = async (req, res) => {
  try {
    const { Leave } = req.app.get('models');
    const leaves = await Leave.findAll({
      include: [
        {
          model: req.app.get('models').User,
          as: 'employee',
          attributes: ['id', 'name', 'employee_code']
        },
        {
          model: req.app.get('models').LeaveType,
          as: 'leaveType',
          attributes: ['id', 'name', 'code', 'color']
        }
      ],
      order: [['applied_date', 'DESC']]
    });

    // Format response to match frontend expectations
    const formattedLeaves = leaves.map(leave => ({
      _id: leave.id,
      employeeId: {
        name: leave.employee?.name,
        employeeCode: leave.employee?.employee_code
      },
      leaveTypeId: {
        name: leave.leaveType?.name,
        code: leave.leaveType?.code,
        color: leave.leaveType?.color
      },
      startDate: leave.start_date,
      endDate: leave.end_date,
      totalDays: leave.total_days,
      reason: leave.reason,
      status: leave.status,
      appliedDate: leave.applied_date,
      approvalFlow: leave.approval_flow,
      currentApprovalLevel: leave.current_approval_level,
      rejectionReason: leave.rejection_reason,
      isHalfDay: leave.is_half_day,
      halfDayType: leave.half_day_type
    }));

    res.json({
      success: true,
      count: formattedLeaves.length,
      data: formattedLeaves
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET my leaves (for authenticated user)
const getMyLeaves = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId; // Assuming auth middleware sets req.user
    const { status, year, page = 1, limit = 10 } = req.query;

    const whereClause = {
      employee_id: userId
    };

    if (status) {
      whereClause.status = status;
    }

    if (year) {
      whereClause.start_date = {
        [Op.gte]: new Date(`${year}-01-01`),
        [Op.lte]: new Date(`${year}-12-31`)
      };
    }

    const offset = (page - 1) * limit;

    const { Leave } = req.app.get('models');
    const { count, rows: leaves } = await Leave.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: req.app.get('models').LeaveType,
          as: 'leaveType',
          attributes: ['id', 'name', 'code', 'color']
        }
      ],
      order: [['applied_date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const formattedLeaves = leaves.map(leave => ({
      _id: leave.id,
      leaveTypeId: {
        name: leave.leaveType?.name,
        code: leave.leaveType?.code,
        color: leave.leaveType?.color
      },
      startDate: leave.start_date,
      endDate: leave.end_date,
      totalDays: leave.total_days,
      reason: leave.reason,
      status: leave.status,
      appliedDate: leave.applied_date,
      approvalFlow: leave.approval_flow,
      currentApprovalLevel: leave.current_approval_level,
      rejectionReason: leave.rejection_reason,
      isHalfDay: leave.is_half_day,
      halfDayType: leave.half_day_type
    }));

    res.json({
      success: true,
      data: formattedLeaves,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(count / limit),
        total: count,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Apply for leave
const applyLeave = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.employeeId;
    const {
      leaveTypeId,
      startDate,
      endDate,
      reason,
      isHalfDay = false,
      halfDayType,
      emergencyContact,
      handoverNotes
    } = req.body;

    // Calculate total days
    let totalDays = 1;
    if (isHalfDay) {
      totalDays = 0.5;
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeDiff = end.getTime() - start.getTime();
      totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    }

    const leaveData = {
      employee_id: userId,
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: isHalfDay ? startDate : endDate,
      total_days: totalDays,
      reason,
      is_half_day: isHalfDay,
      half_day_type: halfDayType,
      emergency_contact: emergencyContact,
      handover_notes: handoverNotes,
      status: 'Pending',
      applied_date: new Date()
    };

    const { Leave } = req.app.get('models');
    const leave = await Leave.create(leaveData);

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: leave
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel leave
const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { Leave } = req.app.get('models');
    const leave = await Leave.findOne({
      where: {
        id,
        employee_id: userId,
        status: 'Pending'
      }
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found or cannot be cancelled'
      });
    }

    await leave.update({ status: 'Cancelled' });

    res.json({
      success: true,
      message: 'Leave application cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get leave balance for user
const getLeaveBalance = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    
    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const currentYear = new Date().getFullYear();

    // Get all leave types
    const leaveTypes = await req.app.get('models').LeaveType.findAll({
      where: { is_active: true }
    });

    // Get used leaves for current year
    const { Leave } = req.app.get('models');
    const usedLeaves = await Leave.findAll({
      where: {
        employee_id: userId,
        status: 'Approved',
        start_date: {
          [Op.gte]: new Date(`${currentYear}-01-01`),
          [Op.lte]: new Date(`${currentYear}-12-31`)
        }
      },
      include: [
        {
          model: req.app.get('models').LeaveType,
          as: 'leaveType'
        }
      ]
    });

    // Calculate balance for each leave type
    const leaveBalance = leaveTypes.map(leaveType => {
      const used = usedLeaves
        .filter(leave => leave.leave_type_id === leaveType.id)
        .reduce((sum, leave) => sum + parseFloat(leave.total_days), 0);

      const allocated = leaveType.max_days_per_year;
      const balance = allocated - used;

      return {
        leaveType: {
          id: leaveType.id,
          name: leaveType.name,
          code: leaveType.code,
          color: leaveType.color
        },
        allocated,
        used,
        balance: Math.max(0, balance)
      };
    });

    res.json({
      success: true,
      data: leaveBalance
    });
  } catch (error) {
    console.error('Error getting leave balance:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET leave by ID
const getLeaveById = async (req, res) => {
  try {
    const { Leave } = req.app.get('models');
    const leave = await Leave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave record not found'
      });
    }
    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new leave
const createLeave = async (req, res) => {
  try {
    const { Leave } = req.app.get('models');
    const leave = await Leave.create(req.body);
    res.status(201).json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a leave
const updateLeave = async (req, res) => {
  try {
    const { Leave } = req.app.get('models');
    const leave = await Leave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave record not found'
      });
    }
    
    await leave.update(req.body);
    res.json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a leave
const deleteLeave = async (req, res) => {
  try {
    const { Leave } = req.app.get('models');
    const leave = await Leave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave record not found'
      });
    }
    
    await leave.destroy();
    res.json({
      success: true,
      message: 'Leave record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLeaves,
  getLeaveById,
  createLeave,
  updateLeave,
  deleteLeave,
  getMyLeaves,
  applyLeave,
  cancelLeave,
  getLeaveBalance
};