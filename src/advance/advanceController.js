// Advance Controller
const { Advance, AdvanceRepayment, User, sequelize } = require('../config/database');
const { Op } = require('sequelize');

// Create new advance request (User)
exports.createAdvance = async (req, res) => {
  try {
    const { requestedAmount, reason } = req.body;
    const userId = req.user.id;

    if (!requestedAmount || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Requested amount and reason are required'
      });
    }

    const advance = await Advance.create({
      user_id: userId,
      requested_amount: requestedAmount,
      reason: reason,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Advance request created successfully',
      data: advance
    });
  } catch (error) {
    console.error('Create advance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create advance request',
      error: error.message
    });
  }
};

// Create advance by admin (for any user)
exports.createAdvanceByAdmin = async (req, res) => {
  try {
    const { userId, requestedAmount, reason, advanceDate } = req.body;

    if (!userId || !requestedAmount || !reason) {
      return res.status(400).json({
        success: false,
        message: 'User ID, requested amount and reason are required'
      });
    }

    const advance = await Advance.create({
      user_id: userId,
      requested_amount: requestedAmount,
      reason: reason,
      status: 'pending',
      advance_date: advanceDate || new Date().toISOString().split('T')[0]
    });

    res.status(201).json({
      success: true,
      message: 'Advance created successfully',
      data: advance
    });
  } catch (error) {
    console.error('Create advance by admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create advance',
      error: error.message
    });
  }
};

// Get all advances (Admin)
exports.getAllAdvances = async (req, res) => {
  try {
    const { status, userId, startDate, endDate } = req.query;
    
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (userId) {
      whereClause.user_id = userId;
    }
    
    if (startDate || endDate) {
      whereClause.request_date = {};
      if (startDate) {
        whereClause.request_date[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.request_date[Op.lte] = new Date(endDate);
      }
    }

    const advances = await Advance.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'employee_code', 'role', 'email', 'mobile_number']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'employee_code']
        }
      ],
      order: [['request_date', 'DESC']]
    });

    res.json({
      success: true,
      data: advances
    });
  } catch (error) {
    console.error('Get all advances error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advances',
      error: error.message
    });
  }
};

// Get advance by ID
exports.getAdvanceById = async (req, res) => {
  try {
    const { id } = req.params;

    const advance = await Advance.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'employee_code', 'role', 'email', 'mobile_number']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'employee_code']
        },
        {
          model: AdvanceRepayment,
          as: 'repayments',
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    res.json({
      success: true,
      data: advance
    });
  } catch (error) {
    console.error('Get advance by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch advance',
      error: error.message
    });
  }
};

// Get user's own advances
exports.getMyAdvances = async (req, res) => {
  try {
    const userId = req.user.id;

    const advances = await Advance.findAll({
      where: { user_id: userId },
      include: [
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'employee_code']
        }
      ],
      order: [['request_date', 'DESC']]
    });

    res.json({
      success: true,
      data: advances
    });
  } catch (error) {
    console.error('Get my advances error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your advances',
      error: error.message
    });
  }
};

// Update advance status (Approve/Reject) - Admin only
exports.updateAdvanceStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const {
      status,
      approvedAmount,
      adminNotes,
      repaymentStartDate,
      repaymentEndDate,
      monthlyDeduction,
      advanceDate
    } = req.body;
    const approvedBy = req.user.id;

    const advance = await Advance.findByPk(id);

    if (!advance) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Advance has already been processed'
      });
    }

    await advance.update({
      status,
      approved_amount: approvedAmount || 0,
      approved_by: approvedBy,
      approval_date: new Date(),
      advance_date: advanceDate || advance.advance_date || new Date().toISOString().split('T')[0],
      admin_notes: adminNotes,
      repayment_start_date: repaymentStartDate,
      repayment_end_date: repaymentEndDate,
      monthly_deduction: monthlyDeduction || 0
    }, { transaction });

    await transaction.commit();

    const updatedAdvance = await Advance.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'employee_code', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name']
        }
      ]
    });

    res.json({
      success: true,
      message: `Advance ${status} successfully`,
      data: updatedAdvance
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Update advance status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update advance status',
      error: error.message
    });
  }
};

// Add repayment
exports.addRepayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { advanceId, amount, repaymentDate, paymentMethod, notes } = req.body;
    const createdBy = req.user.id;

    const advance = await Advance.findByPk(advanceId);

    if (!advance) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    if (advance.status !== 'approved' && advance.status !== 'partially_approved') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Can only add repayment for approved advances'
      });
    }

    // Create repayment record
    const repayment = await AdvanceRepayment.create({
      advance_id: advanceId,
      repayment_date: repaymentDate,
      amount,
      payment_method: paymentMethod || 'salary_deduction',
      notes,
      created_by: createdBy
    }, { transaction });

    // Update advance total_repaid and repayment_status
    const newTotalRepaid = parseFloat(advance.total_repaid) + parseFloat(amount);
    const approvedAmount = parseFloat(advance.approved_amount);
    
    let newRepaymentStatus = 'in_progress';
    if (newTotalRepaid >= approvedAmount) {
      newRepaymentStatus = 'completed';
    } else if (newTotalRepaid === 0) {
      newRepaymentStatus = 'pending';
    }

    await advance.update({
      total_repaid: newTotalRepaid,
      repayment_status: newRepaymentStatus
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Repayment added successfully',
      data: repayment
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Add repayment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add repayment',
      error: error.message
    });
  }
};

// Get repayment history
exports.getRepaymentHistory = async (req, res) => {
  try {
    const { advanceId } = req.params;

    const repayments = await AdvanceRepayment.findAll({
      where: { advance_id: advanceId },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name']
        }
      ],
      order: [['repayment_date', 'DESC']]
    });

    res.json({
      success: true,
      data: repayments
    });
  } catch (error) {
    console.error('Get repayment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repayment history',
      error: error.message
    });
  }
};

// Get statistics
exports.getStatistics = async (req, res) => {
  try {
    const { userId } = req.query;
    
    const whereClause = userId ? { user_id: userId } : {};

    const stats = await Advance.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_requests'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'pending' THEN 1 ELSE 0 END")), 'pending_requests'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'approved' THEN 1 ELSE 0 END")), 'approved_requests'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'rejected' THEN 1 ELSE 0 END")), 'rejected_requests'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status IN ('approved', 'partially_approved') THEN approved_amount ELSE 0 END")), 'total_approved_amount'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status IN ('approved', 'partially_approved') THEN total_repaid ELSE 0 END")), 'total_repaid_amount'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status IN ('approved', 'partially_approved') THEN (approved_amount - total_repaid) ELSE 0 END")), 'total_outstanding']
      ],
      raw: true
    });

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// Delete advance
exports.deleteAdvance = async (req, res) => {
  try {
    const { id } = req.params;

    const advance = await Advance.findByPk(id);

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: 'Advance not found'
      });
    }

    await advance.destroy();

    res.json({
      success: true,
      message: 'Advance deleted successfully'
    });
  } catch (error) {
    console.error('Delete advance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete advance',
      error: error.message
    });
  }
};
