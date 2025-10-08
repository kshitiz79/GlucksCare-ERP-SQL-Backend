const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// Helper function to get subordinate user IDs based on hierarchy
const getSubordinateUserIds = async (userId, role, targetMonth, targetYear) => {
  try {
    const user = await sequelize.models.User.findByPk(userId, {
      attributes: ['id', 'role', 'state_id']
    });

    if (!user) {
      console.log(`User ${userId} not found`);
      return [];
    }

    let subordinateIds = [];

    switch (role) {
      case 'National Head':
        // Gets all users below National Head (everyone except Super Admin, Admin, Opps Team, National Head)
        const allUsers = await sequelize.models.User.findAll({
          where: {
            role: { [Op.in]: ['State Head', 'Zonal Manager', 'Area Manager', 'Manager', 'User'] },
            id: { [Op.ne]: userId }
          },
          attributes: ['id']
        });
        subordinateIds = allUsers.map(u => u.id);
        console.log(`National Head ${userId} has ${subordinateIds.length} subordinates`);
        break;

      case 'State Head':
        // Gets all users in head offices that belong to this state
        if (user.state_id) {
          // Find all users whose head offices belong to this state
          const stateUsers = await sequelize.query(`
            SELECT DISTINCT u.id
            FROM users u
            INNER JOIN user_head_offices uho ON u.id = uho.user_id
            INNER JOIN head_offices ho ON uho.head_office_id = ho.id
            WHERE ho.state_id = :stateId
            AND u.role IN ('Zonal Manager', 'Area Manager', 'Manager', 'User')
            AND u.id != :userId
          `, {
            replacements: { stateId: user.state_id, userId },
            type: sequelize.QueryTypes.SELECT
          });
          subordinateIds = (stateUsers || []).map(u => u.id);
          console.log(`State Head ${userId} (state: ${user.state_id}) has ${subordinateIds.length} subordinates`);
        } else {
          console.log(`State Head ${userId} has no state_id assigned - will aggregate all users`);
          // If no state assigned, aggregate all lower-level users
          const allLowerUsers = await sequelize.models.User.findAll({
            where: {
              role: { [Op.in]: ['Zonal Manager', 'Area Manager', 'Manager', 'User'] },
              id: { [Op.ne]: userId }
            },
            attributes: ['id']
          });
          subordinateIds = allLowerUsers.map(u => u.id);
        }
        break;

      case 'Zonal Manager':
        // Gets Area Managers assigned to this Zonal Manager
        const zonalManagerAreas = await sequelize.models.ZonalManagerAreaManager.findAll({
          where: { zonal_manager_id: userId },
          attributes: ['area_manager_id']
        });
        const areaManagerIds = zonalManagerAreas.map(zm => zm.area_manager_id);
        console.log(`Zonal Manager ${userId} has ${areaManagerIds.length} area managers assigned`);
        
        // Get Managers and Users under these Area Managers
        if (areaManagerIds.length > 0) {
          const areaManagerSubordinates = await sequelize.models.AreaManagerManager.findAll({
            where: { area_manager_id: { [Op.in]: areaManagerIds } },
            attributes: ['manager_id']
          });
          const managerIds = areaManagerSubordinates.map(am => am.manager_id);
          
          // Get Users under these Managers using raw query to avoid association issues
          if (managerIds.length > 0) {
            const managerUsers = await sequelize.query(`
              SELECT DISTINCT u.id
              FROM users u
              INNER JOIN user_head_offices uho ON u.id = uho.user_id
              WHERE u.role = 'User'
              AND uho.head_office_id IN (
                SELECT head_office_id 
                FROM user_head_offices 
                WHERE user_id IN (:managerIds)
              )
            `, {
              replacements: { managerIds },
              type: sequelize.QueryTypes.SELECT
            });
            
            subordinateIds = [...areaManagerIds, ...managerIds, ...(managerUsers || []).map(u => u.id)];
            console.log(`Zonal Manager ${userId} total subordinates: ${subordinateIds.length}`);
          } else {
            subordinateIds = areaManagerIds;
          }
        }
        break;

      case 'Area Manager':
        // Gets Managers assigned to this Area Manager
        const areaManagerManagers = await sequelize.models.AreaManagerManager.findAll({
          where: { area_manager_id: userId },
          attributes: ['manager_id']
        });
        const managerIdsForArea = areaManagerManagers.map(am => am.manager_id);
        console.log(`Area Manager ${userId} has ${managerIdsForArea.length} managers assigned`);
        
        // Get Users under these Managers using raw query
        if (managerIdsForArea.length > 0) {
          const usersUnderManagers = await sequelize.query(`
            SELECT DISTINCT u.id
            FROM users u
            INNER JOIN user_head_offices uho ON u.id = uho.user_id
            WHERE u.role = 'User'
            AND uho.head_office_id IN (
              SELECT head_office_id 
              FROM user_head_offices 
              WHERE user_id IN (:managerIds)
            )
          `, {
            replacements: { managerIds: managerIdsForArea },
            type: sequelize.QueryTypes.SELECT
          });
          
          subordinateIds = [...managerIdsForArea, ...(usersUnderManagers || []).map(u => u.id)];
          console.log(`Area Manager ${userId} total subordinates: ${subordinateIds.length}`);
        }
        break;

      case 'Manager':
        // Gets Users in the same head office using raw query
        const headOfficeUsers = await sequelize.query(`
          SELECT DISTINCT u.id
          FROM users u
          INNER JOIN user_head_offices uho ON u.id = uho.user_id
          WHERE u.role = 'User'
          AND uho.head_office_id IN (
            SELECT head_office_id 
            FROM user_head_offices 
            WHERE user_id = :userId
          )
        `, {
          replacements: { userId },
          type: sequelize.QueryTypes.SELECT
        });
        subordinateIds = (headOfficeUsers || []).map(u => u.id);
        console.log(`Manager ${userId} has ${subordinateIds.length} users in same head office`);
        break;

      default:
        subordinateIds = [];
    }

    return subordinateIds;
  } catch (error) {
    console.error('Error in getSubordinateUserIds:', error);
    return [];
  }
};

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

    // Calculate aggregated targets for hierarchical roles
    const transformedTargets = await Promise.all(targets.map(async (target) => {
      const plainTarget = target.toJSON();
      const userRole = plainTarget.salesTargetUser?.role;
      
      let aggregatedTarget = parseFloat(plainTarget.target_amount) || 0;
      let aggregatedAchieved = parseFloat(plainTarget.achieved_amount) || 0;
      
      // Only aggregate for hierarchical roles
      if (['Manager', 'Area Manager', 'Zonal Manager', 'State Head', 'National Head'].includes(userRole)) {
        const subordinateIds = await getSubordinateUserIds(
          plainTarget.user_id,
          userRole,
          plainTarget.target_month,
          plainTarget.target_year
        );
        
        if (subordinateIds.length > 0) {
          const subordinateTargets = await sequelize.models.SalesTarget.findAll({
            where: {
              user_id: { [Op.in]: subordinateIds },
              target_month: plainTarget.target_month,
              target_year: plainTarget.target_year
            },
            attributes: ['target_amount', 'achieved_amount']
          });
          
          const subordinateTargetSum = subordinateTargets.reduce((sum, t) => sum + parseFloat(t.target_amount || 0), 0);
          const subordinateAchievedSum = subordinateTargets.reduce((sum, t) => sum + parseFloat(t.achieved_amount || 0), 0);
          
          aggregatedTarget += subordinateTargetSum;
          aggregatedAchieved += subordinateAchievedSum;
        }
      }
      
      const aggregatedPercentage = aggregatedTarget > 0 ? Math.round((aggregatedAchieved / aggregatedTarget) * 100) : 0;
      
      return {
        ...plainTarget,
        _id: plainTarget.id,
        userId: plainTarget.salesTargetUser ? {
          _id: plainTarget.salesTargetUser.id,
          name: plainTarget.salesTargetUser.name,
          employeeCode: plainTarget.salesTargetUser.employee_code,
          role: plainTarget.salesTargetUser.role
        } : null,
        targetAmount: plainTarget.target_amount,
        targetMonth: plainTarget.target_month,
        targetYear: plainTarget.target_year,
        completionDeadline: plainTarget.completion_deadline,
        achievedAmount: plainTarget.achieved_amount,
        achievementPercentage: plainTarget.achievement_percentage,
        // Add aggregated values
        aggregatedTargetAmount: aggregatedTarget,
        aggregatedAchievedAmount: aggregatedAchieved,
        aggregatedPercentage: aggregatedPercentage
      };
    }));

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
        employeeCode: plainTarget.salesTargetUser.employee_code,
        role: plainTarget.salesTargetUser.role
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
        employeeCode: plainTarget.salesTargetUser.employee_code,
        role: plainTarget.salesTargetUser.role
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
        employeeCode: plainTarget.salesTargetUser.employee_code,
        role: plainTarget.salesTargetUser.role
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

const deleteSalesTarget = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    // Find the sales target by ID
    const salesTarget = await sequelize.models.SalesTarget.findByPk(req.params.id, { transaction });
    if (!salesTarget) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }


    // Delete the sales target
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
          employeeCode: plainTarget.salesTargetUser.employee_code,
          role: plainTarget.salesTargetUser.role
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
        employeeCode: plainTarget.salesTargetUser.employee_code,
        role: plainTarget.salesTargetUser.role
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