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

// GET pending approvals for managers/admins
const getPendingApprovals = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate user
    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Define roles that can approve leaves
    const approverRoles = [
      'Super Admin',
      'Admin',
      'National Head',
      'State Head',
      'Zonal Manager',
      'Area Manager',
      'Manager'
    ];

    if (!approverRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view pending approvals'
      });
    }

    const { Leave, User } = req.app.get('models');

    // Build where clause based on user role
    let whereClause = {
      status: 'Pending'
    };

    // For non-admin roles, filter based on hierarchy
    if (!['Super Admin', 'Admin'].includes(userRole)) {
      // Get current user details to filter based on hierarchy
      const currentUser = await User.findByPk(userId);

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Build hierarchy filter based on role
      const hierarchyFilter = {};

      switch (userRole) {
        case 'National Head':
          // Can approve all leaves
          break;
        case 'State Head':
          hierarchyFilter.state_id = currentUser.state_id;
          break;
        case 'Zonal Manager':
          hierarchyFilter.head_office_id = currentUser.head_office_id;
          break;
        case 'Area Manager':
        case 'Manager':
          hierarchyFilter.head_office_id = currentUser.head_office_id;
          hierarchyFilter.branch_id = currentUser.branch_id;
          break;
      }

      // If hierarchy filter exists, apply it to employee filter
      if (Object.keys(hierarchyFilter).length > 0) {
        whereClause['$employee.head_office_id$'] = hierarchyFilter.head_office_id;
        if (hierarchyFilter.branch_id) {
          whereClause['$employee.branch_id$'] = hierarchyFilter.branch_id;
        }
        if (hierarchyFilter.state_id) {
          whereClause['$employee.state_id$'] = hierarchyFilter.state_id;
        }
      }
    }

    // Get pending leaves with employee and leave type details
    const pendingLeaves = await Leave.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'name', 'employee_code', 'role', 'head_office_id', 'branch_id', 'state_id'],
          required: true
        },
        {
          model: req.app.get('models').LeaveType,
          as: 'leaveType',
          attributes: ['id', 'name', 'code', 'color']
        }
      ],
      order: [['applied_date', 'ASC']] // Oldest first for approval queue
    });

    // Format response to match frontend expectations
    const formattedLeaves = pendingLeaves.map(leave => ({
      _id: leave.id,
      employeeId: {
        name: leave.employee?.name,
        employeeCode: leave.employee?.employee_code,
        role: leave.employee?.role
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
      emergencyContact: leave.emergency_contact,
      handoverNotes: leave.handover_notes,
      isHalfDay: leave.is_half_day,
      halfDayType: leave.half_day_type,
      documents: leave.documents
    }));

    res.json({
      success: true,
      count: formattedLeaves.length,
      data: formattedLeaves
    });

  } catch (error) {
    console.error('Error getting pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching pending approvals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Approve or reject leave
const approveRejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Validate input
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    if (action === 'reject' && !comments) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required for rejection'
      });
    }

    // Check if user has approval permissions
    const approverRoles = [
      'Super Admin',
      'Admin',
      'National Head',
      'State Head',
      'Zonal Manager',
      'Area Manager',
      'Manager'
    ];

    if (!approverRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to approve/reject leaves'
      });
    }

    const { Leave } = req.app.get('models');
    const leave = await Leave.findByPk(id, {
      include: [
        {
          model: req.app.get('models').User,
          as: 'employee',
          attributes: ['id', 'name', 'employee_code']
        }
      ]
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave application is not in pending status'
      });
    }

    // Update leave status
    const updateData = {
      status: action === 'approve' ? 'Approved' : 'Rejected',
      updated_by: userId
    };

    if (action === 'approve') {
      updateData.final_approval_date = new Date();
    } else {
      updateData.rejection_reason = comments;
    }

    // Update approval flow
    const approvalFlow = leave.approval_flow || [];
    approvalFlow.push({
      approver_id: userId,
      action: action,
      comments: comments,
      timestamp: new Date()
    });
    updateData.approval_flow = approvalFlow;

    await leave.update(updateData);

    res.json({
      success: true,
      message: `Leave application ${action}d successfully`,
      data: {
        id: leave.id,
        status: updateData.status,
        employee: leave.employee?.name
      }
    });

  } catch (error) {
    console.error('Error approving/rejecting leave:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while processing leave approval',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
  getLeaveBalance,
  getPendingApprovals,
  approveRejectLeave
};