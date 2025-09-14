const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// GET all sales targets with filtering and pagination
const getAllSalesTargets = async (req, res) => {
  try {
    const {
      userId,
      targetMonth,
      targetYear,
      status,
      page = 1,
      limit = 10
    } = req.query;

    // Build query filters
    let whereClause = {};
    
    if (userId) whereClause.user_id = userId;
    if (targetMonth) whereClause.target_month = parseInt(targetMonth);
    if (targetYear) whereClause.target_year = parseInt(targetYear);
    if (status) whereClause.status = status;

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get targets with user information
    const { count, rows: targets } = await sequelize.models.SalesTarget.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.User,
          as: 'salesTargetUser',
          attributes: ['id', 'name', 'email', 'employee_code', 'role']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetCreator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetUpdater',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Transform data to match frontend expectations
    const transformedTargets = targets.map(target => {
      const plainTarget = target.toJSON();
      return {
        ...plainTarget,
        _id: plainTarget.id,
        userId: plainTarget.salesTargetUser ? {
          _id: plainTarget.salesTargetUser.id,
          name: plainTarget.salesTargetUser.name,
          employeeCode: plainTarget.salesTargetUser.employee_code
        } : null,
        targetAmount: plainTarget.target_amount,
        targetMonth: plainTarget.target_month,
        targetYear: plainTarget.target_year,
        completionDeadline: plainTarget.completion_deadline,
        achievedAmount: plainTarget.achieved_amount,
        achievementPercentage: plainTarget.achievement_percentage
      };
    });

    res.json({
      success: true,
      data: transformedTargets,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        total: count
      }
    });
  } catch (error) {
    console.error('Get all sales targets error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// GET sales target by ID
const getSalesTargetById = async (req, res) => {
  try {
    const salesTarget = await sequelize.models.SalesTarget.findByPk(req.params.id, {
      include: [
        {
          model: sequelize.models.User,
          as: 'salesTargetUser',
          attributes: ['id', 'name', 'email', 'employee_code', 'role']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetCreator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetUpdater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!salesTarget) {
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }

    // Transform data to match frontend expectations
    const plainTarget = salesTarget.toJSON();
    const transformedTarget = {
      ...plainTarget,
      _id: plainTarget.id,
      userId: plainTarget.salesTargetUser ? {
        _id: plainTarget.salesTargetUser.id,
        name: plainTarget.salesTargetUser.name,
        employeeCode: plainTarget.salesTargetUser.employee_code
      } : null,
      targetAmount: plainTarget.target_amount,
      targetMonth: plainTarget.target_month,
      targetYear: plainTarget.target_year,
      completionDeadline: plainTarget.completion_deadline,
      achievedAmount: plainTarget.achieved_amount,
      achievementPercentage: plainTarget.achievement_percentage
    };

    res.json({
      success: true,
      data: transformedTarget
    });
  } catch (error) {
    console.error('Get sales target by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// CREATE a new sales target
const createSalesTarget = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Only Admin and Super Admin can create targets
    if (!['Admin', 'Super Admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admin can assign targets'
      });
    }

    const { userId, targetAmount, targetMonth, targetYear, completionDeadline, notes } = req.body;

    // Validate required fields
    if (!userId || !targetAmount || !targetMonth || !targetYear || !completionDeadline) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if user exists
    const user = await sequelize.models.User.findByPk(userId);
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if target already exists for this user and period
    const existingTarget = await sequelize.models.SalesTarget.findOne({
      where: {
        user_id: userId,
        target_month: parseInt(targetMonth),
        target_year: parseInt(targetYear)
      },
      transaction
    });

    if (existingTarget) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Target already exists for ${user.name} for ${targetMonth}/${targetYear}`
      });
    }

    // Create new target
    const newTarget = await sequelize.models.SalesTarget.create({
      user_id: userId,
      target_amount: parseFloat(targetAmount),
      target_month: parseInt(targetMonth),
      target_year: parseInt(targetYear),
      completion_deadline: new Date(completionDeadline),
      notes,
      created_by: req.user.id,
      updated_by: req.user.id
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Get the created target with user information
    const populatedTarget = await sequelize.models.SalesTarget.findByPk(newTarget.id, {
      include: [
        {
          model: sequelize.models.User,
          as: 'salesTargetUser',
          attributes: ['id', 'name', 'email', 'employee_code', 'role']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetCreator',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // Transform data to match frontend expectations
    const plainTarget = populatedTarget.toJSON();
    const transformedTarget = {
      ...plainTarget,
      _id: plainTarget.id,
      userId: plainTarget.salesTargetUser ? {
        _id: plainTarget.salesTargetUser.id,
        name: plainTarget.salesTargetUser.name,
        employeeCode: plainTarget.salesTargetUser.employee_code
      } : null,
      targetAmount: plainTarget.target_amount,
      targetMonth: plainTarget.target_month,
      targetYear: plainTarget.target_year,
      completionDeadline: plainTarget.completion_deadline,
      achievedAmount: plainTarget.achieved_amount,
      achievementPercentage: plainTarget.achievement_percentage
    };

    res.status(201).json({
      success: true,
      message: 'Sales target created successfully',
      data: transformedTarget
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Create sales target error:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Target already exists for this user and period'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// UPDATE a sales target
const updateSalesTarget = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Only Admin and Super Admin can update targets
    if (!['Admin', 'Super Admin'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admin can update targets'
      });
    }

    const { targetAmount, completionDeadline, notes, achievedAmount } = req.body;

    const salesTarget = await sequelize.models.SalesTarget.findByPk(req.params.id, { transaction });
    if (!salesTarget) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }

    // Update fields
    if (targetAmount !== undefined) salesTarget.target_amount = parseFloat(targetAmount);
    if (completionDeadline) salesTarget.completion_deadline = new Date(completionDeadline);
    if (notes !== undefined) salesTarget.notes = notes;
    if (achievedAmount !== undefined) salesTarget.achieved_amount = parseFloat(achievedAmount);
    
    // Update updated_by field
    salesTarget.updated_by = req.user.id;

    // Save the updated target
    await salesTarget.save({ transaction });

    // Commit transaction
    await transaction.commit();

    // Get the updated target with user information
    const updatedTarget = await sequelize.models.SalesTarget.findByPk(salesTarget.id, {
      include: [
        {
          model: sequelize.models.User,
          as: 'salesTargetUser',
          attributes: ['id', 'name', 'email', 'employee_code', 'role']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetCreator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetUpdater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // Transform data to match frontend expectations
    const plainTarget = updatedTarget.toJSON();
    const transformedTarget = {
      ...plainTarget,
      _id: plainTarget.id,
      userId: plainTarget.salesTargetUser ? {
        _id: plainTarget.salesTargetUser.id,
        name: plainTarget.salesTargetUser.name,
        employeeCode: plainTarget.salesTargetUser.employee_code
      } : null,
      targetAmount: plainTarget.target_amount,
      targetMonth: plainTarget.target_month,
      targetYear: plainTarget.target_year,
      completionDeadline: plainTarget.completion_deadline,
      achievedAmount: plainTarget.achieved_amount,
      achievementPercentage: plainTarget.achievement_percentage
    };

    res.json({
      success: true,
      message: 'Sales target updated successfully',
      data: transformedTarget
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Update sales target error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// DELETE a sales target
const deleteSalesTarget = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Only Super Admin can delete targets
    if (req.user.role !== 'Super Admin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Super Admin can delete targets'
      });
    }

    const salesTarget = await sequelize.models.SalesTarget.findByPk(req.params.id, { transaction });
    if (!salesTarget) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }

    await salesTarget.destroy({ transaction });

    // Commit transaction
    await transaction.commit();

    res.json({
      success: true,
      message: 'Sales target deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Delete sales target error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get targets for a specific user
const getTargetsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, status } = req.query;

    let whereClause = { user_id: userId };

    if (year) whereClause.target_year = parseInt(year);
    if (status) whereClause.status = status;

    const targets = await sequelize.models.SalesTarget.findAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.User,
          as: 'salesTargetUser',
          attributes: ['id', 'name', 'email', 'employee_code', 'role']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetCreator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetUpdater',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['target_year', 'DESC'], ['target_month', 'DESC']]
    });

    // Transform data to match frontend expectations
    const transformedTargets = targets.map(target => {
      const plainTarget = target.toJSON();
      return {
        ...plainTarget,
        _id: plainTarget.id,
        userId: plainTarget.salesTargetUser ? {
          _id: plainTarget.salesTargetUser.id,
          name: plainTarget.salesTargetUser.name,
          employeeCode: plainTarget.salesTargetUser.employee_code
        } : null,
        targetAmount: plainTarget.target_amount,
        targetMonth: plainTarget.target_month,
        targetYear: plainTarget.target_year,
        completionDeadline: plainTarget.completion_deadline,
        achievedAmount: plainTarget.achieved_amount,
        achievementPercentage: plainTarget.achievement_percentage
      };
    });

    res.json({
      success: true,
      data: transformedTargets
    });
  } catch (error) {
    console.error('Get targets by user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get current user's targets
const getMyTargets = async (req, res) => {
  try {
    const { year, status } = req.query;

    let whereClause = { user_id: req.user.id };

    if (year) whereClause.target_year = parseInt(year);
    if (status) whereClause.status = status;

    const targets = await sequelize.models.SalesTarget.findAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.User,
          as: 'salesTargetCreator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetUpdater',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['target_year', 'DESC'], ['target_month', 'DESC']]
    });

    // Transform data to match frontend expectations
    const transformedTargets = targets.map(target => {
      const plainTarget = target.toJSON();
      return {
        ...plainTarget,
        _id: plainTarget.id,
        targetAmount: plainTarget.target_amount,
        targetMonth: plainTarget.target_month,
        targetYear: plainTarget.target_year,
        completionDeadline: plainTarget.completion_deadline,
        achievedAmount: plainTarget.achieved_amount,
        achievementPercentage: plainTarget.achievement_percentage
      };
    });

    res.json({
      success: true,
      data: transformedTargets
    });
  } catch (error) {
    console.error('Get my targets error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Update target achievement
const updateTargetAchievement = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { achievedAmount } = req.body;

    if (achievedAmount === undefined || achievedAmount < 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Valid achieved amount is required'
      });
    }

    const salesTarget = await sequelize.models.SalesTarget.findByPk(req.params.id, { transaction });
    if (!salesTarget) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }

    // Check if user can update this target (own target or admin)
    if (salesTarget.user_id !== req.user.id &&
      !['Admin', 'Super Admin'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update achievement fields
    salesTarget.achieved_amount = parseFloat(achievedAmount);
    
    // Calculate achievement percentage
    if (salesTarget.target_amount > 0) {
      salesTarget.achievement_percentage = Math.round((salesTarget.achieved_amount / salesTarget.target_amount) * 100);
    }
    
    // Update status based on achievement and deadline
    const now = new Date();
    if (salesTarget.achievement_percentage >= 100) {
      salesTarget.status = 'Completed';
    } else if (now > salesTarget.completion_deadline) {
      salesTarget.status = 'Overdue';
    } else {
      salesTarget.status = 'Active';
    }
    
    // Update updated_by field
    salesTarget.updated_by = req.user.id;

    // Save the updated target
    await salesTarget.save({ transaction });

    // Commit transaction
    await transaction.commit();

    // Get the updated target with user information
    const updatedTarget = await sequelize.models.SalesTarget.findByPk(salesTarget.id, {
      include: [
        {
          model: sequelize.models.User,
          as: 'salesTargetUser',
          attributes: ['id', 'name', 'email', 'employee_code', 'role']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetCreator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: sequelize.models.User,
          as: 'salesTargetUpdater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // Transform data to match frontend expectations
    const plainTarget = updatedTarget.toJSON();
    const transformedTarget = {
      ...plainTarget,
      _id: plainTarget.id,
      userId: plainTarget.salesTargetUser ? {
        _id: plainTarget.salesTargetUser.id,
        name: plainTarget.salesTargetUser.name,
        employeeCode: plainTarget.salesTargetUser.employee_code
      } : null,
      targetAmount: plainTarget.target_amount,
      targetMonth: plainTarget.target_month,
      targetYear: plainTarget.target_year,
      completionDeadline: plainTarget.completion_deadline,
      achievedAmount: plainTarget.achieved_amount,
      achievementPercentage: plainTarget.achievement_percentage
    };

    res.json({
      success: true,
      message: 'Target achievement updated successfully',
      data: transformedTarget
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Update target achievement error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// Get sales targets dashboard data
const getDashboardData = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Get current month targets with user information
    const currentMonthTargets = await sequelize.models.SalesTarget.findAll({
      where: {
        target_month: currentMonth,
        target_year: currentYear
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'salesTargetUser',
          attributes: ['name', 'email', 'employee_code', 'role']
        }
      ]
    });

    // Calculate summary statistics
    const totalTargets = currentMonthTargets.length;
    const completedTargets = currentMonthTargets.filter(t => t.status === 'Completed').length;
    const overdueTargets = currentMonthTargets.filter(t => t.status === 'Overdue').length;
    const activeTargets = currentMonthTargets.filter(t => t.status === 'Active').length;

    const totalTargetAmount = currentMonthTargets.reduce((sum, t) => sum + parseFloat(t.target_amount), 0);
    const totalAchievedAmount = currentMonthTargets.reduce((sum, t) => sum + parseFloat(t.achieved_amount), 0);
    const overallAchievementPercentage = totalTargetAmount > 0 ?
      Math.round((totalAchievedAmount / totalTargetAmount) * 100) : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalTargets,
          completedTargets,
          overdueTargets,
          activeTargets,
          totalTargetAmount,
          totalAchievedAmount,
          overallAchievementPercentage
        },
        currentMonthTargets
      }
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = {
  getAllSalesTargets,
  getSalesTargetById,
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
  getTargetsByUser,
  getMyTargets,
  updateTargetAchievement,
  getDashboardData
};