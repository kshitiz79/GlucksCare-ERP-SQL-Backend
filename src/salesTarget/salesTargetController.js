const defaultDb = require('../config/database');
const { Op } = require('sequelize');

const getModels = (req) => req?.db || (req?.app && req?.app.get('models')) || defaultDb;
const getSequelize = (req) => req?.tenantSequelize || (req?.app && req?.app.get('sequelize')) || defaultDb.sequelize;

/**
 * GET all sales targets (supports By Head Office and By User views)
 */
const getAllSalesTargets = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const {
      viewMode = 'headoffice', // 'headoffice' | 'user'
      targetMonth,
      targetYear = new Date().getFullYear(),
      status,
      headOfficeId,
      stateId,
      userId,
      search,
      page = 1,
      limit = 100
    } = req.query;

    const monthInt = targetMonth ? parseInt(targetMonth) : null;
    const yearInt = parseInt(targetYear) || new Date().getFullYear();

    // ==========================================
    // 1. HEAD OFFICE VIEW
    // ==========================================
    if (viewMode === 'headoffice') {
      let hoWhere = 'WHERE ho.is_active = true';
      const replacements = { year: yearInt };

      if (monthInt) {
        replacements.month = monthInt;
      }
      if (stateId) {
        hoWhere += ' AND ho.state_id = :stateId';
        replacements.stateId = stateId;
      }
      if (headOfficeId) {
        hoWhere += ' AND ho.id = :headOfficeId';
        replacements.headOfficeId = headOfficeId;
      }
      if (search && search.trim()) {
        hoWhere += ' AND (ho.name ILIKE :searchPattern OR s.name ILIKE :searchPattern)';
        replacements.searchPattern = `%${search.trim()}%`;
      }

      const targetJoin = monthInt
        ? 'LEFT JOIN sales_targets st ON st.head_office_id = ho.id AND st.target_month = :month AND st.target_year = :year'
        : 'LEFT JOIN sales_targets st ON st.head_office_id = ho.id AND st.target_year = :year';

      const hoQuery = `
        SELECT 
          ho.id as head_office_id,
          ho.name as head_office_name,
          ho.pincode,
          s.id as state_id,
          s.name as state_name,
          st.id as target_id,
          st.target_amount,
          st.achieved_amount,
          st.achievement_percentage,
          st.completion_deadline,
          st.status as target_status,
          st.notes,
          st.target_month,
          st.target_year
        FROM head_offices ho
        LEFT JOIN states s ON ho.state_id = s.id
        ${targetJoin}
        ${hoWhere}
        ORDER BY ho.name ASC
      `;

      const hoRows = await sequelize.query(hoQuery, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      // Fetch all assigned users for all active head offices
      const userMappings = await sequelize.query(`
        SELECT DISTINCT
          uho.head_office_id,
          u.id as user_id,
          u.name,
          u.employee_code,
          u.role,
          u.email
        FROM user_head_offices uho
        JOIN users u ON uho.user_id = u.id
        WHERE u.is_active = true
        UNION
        SELECT DISTINCT
          u.head_office_id,
          u.id as user_id,
          u.name,
          u.employee_code,
          u.role,
          u.email
        FROM users u
        WHERE u.head_office_id IS NOT NULL AND u.is_active = true
      `, {
        type: sequelize.QueryTypes.SELECT
      });

      const hoUsersMap = {};
      userMappings.forEach(um => {
        if (!um.head_office_id) return;
        if (!hoUsersMap[um.head_office_id]) {
          hoUsersMap[um.head_office_id] = [];
        }
        if (!hoUsersMap[um.head_office_id].some(u => u.user_id === um.user_id)) {
          hoUsersMap[um.head_office_id].push({
            id: um.user_id,
            _id: um.user_id,
            name: um.name,
            employeeCode: um.employee_code,
            role: um.role,
            email: um.email
          });
        }
      });

      let transformedData = hoRows.map(row => {
        const assignedUsers = hoUsersMap[row.head_office_id] || [];
        const targetAmount = parseFloat(row.target_amount) || 0;
        const achievedAmount = parseFloat(row.achieved_amount) || 0;
        const achievementPercentage = targetAmount > 0 
          ? (row.achievement_percentage !== null ? row.achievement_percentage : Math.round((achievedAmount / targetAmount) * 100))
          : 0;

        let status = 'Unassigned';
        if (row.target_id) {
          status = row.target_status || (achievementPercentage >= 100 ? 'Completed' : 'Active');
        }

        return {
          _id: row.target_id || row.head_office_id,
          targetId: row.target_id,
          headOfficeId: row.head_office_id,
          headOfficeName: row.head_office_name,
          pincode: row.pincode,
          stateId: row.state_id,
          stateName: row.state_name || 'N/A',
          assignedUsers,
          userCount: assignedUsers.length,
          targetAmount,
          achievedAmount,
          achievementPercentage,
          targetMonth: row.target_month || monthInt || (new Date().getMonth() + 1),
          targetYear: row.target_year || yearInt,
          completionDeadline: row.completion_deadline,
          status,
          notes: row.notes || '',
          hasTarget: !!row.target_id
        };
      });

      // Filter by status if provided
      if (status) {
        transformedData = transformedData.filter(item => item.status === status);
      }

      // Calculate summary
      const assignedTargets = transformedData.filter(d => d.hasTarget);
      const totalTargetAmount = assignedTargets.reduce((sum, t) => sum + t.targetAmount, 0);
      const totalAchievedAmount = assignedTargets.reduce((sum, t) => sum + t.achievedAmount, 0);
      const overallPercentage = totalTargetAmount > 0 ? Math.round((totalAchievedAmount / totalTargetAmount) * 100) : 0;
      const completedCount = assignedTargets.filter(t => t.status === 'Completed').length;
      const activeCount = assignedTargets.filter(t => t.status === 'Active').length;
      const overdueCount = assignedTargets.filter(t => t.status === 'Overdue').length;

      return res.json({
        success: true,
        viewMode: 'headoffice',
        data: transformedData,
        summary: {
          totalHeadOffices: transformedData.length,
          totalAssignedHeadOffices: assignedTargets.length,
          totalTargetAmount,
          totalAchievedAmount,
          overallAchievementPercentage: overallPercentage,
          completedTargets: completedCount,
          activeTargets: activeCount,
          overdueTargets: overdueCount
        },
        pagination: {
          current: parseInt(page),
          pages: 1,
          total: transformedData.length
        }
      });
    }

    // ==========================================
    // 2. USER VIEW
    // ==========================================
    let userWhere = 'WHERE u.is_active = true';
    const userReplacements = { year: yearInt };

    if (monthInt) {
      userReplacements.month = monthInt;
    }
    if (userId) {
      userWhere += ' AND u.id = :userId';
      userReplacements.userId = userId;
    }
    if (stateId) {
      userWhere += ' AND u.state_id = :stateId';
      userReplacements.stateId = stateId;
    }
    if (search && search.trim()) {
      userWhere += ' AND (u.name ILIKE :searchPattern OR u.employee_code ILIKE :searchPattern OR u.email ILIKE :searchPattern)';
      userReplacements.searchPattern = `%${search.trim()}%`;
    }

    const usersQuery = `
      SELECT 
        u.id as user_id,
        u.name,
        u.email,
        u.employee_code,
        u.role,
        u.state_id,
        s.name as state_name,
        u.head_office_id as primary_ho_id
      FROM users u
      LEFT JOIN states s ON u.state_id = s.id
      ${userWhere}
      ORDER BY u.name ASC
    `;

    const activeUsers = await sequelize.query(usersQuery, {
      replacements: userReplacements,
      type: sequelize.QueryTypes.SELECT
    });

    // Fetch user head office assignments
    const uhoRows = await sequelize.query(`
      SELECT 
        uho.user_id,
        ho.id as head_office_id,
        ho.name as head_office_name,
        ho.state_id,
        s.name as state_name
      FROM user_head_offices uho
      JOIN head_offices ho ON uho.head_office_id = ho.id
      LEFT JOIN states s ON ho.state_id = s.id
      WHERE ho.is_active = true
      UNION
      SELECT 
        u.id as user_id,
        ho.id as head_office_id,
        ho.name as head_office_name,
        ho.state_id,
        s.name as state_name
      FROM users u
      JOIN head_offices ho ON u.head_office_id = ho.id
      LEFT JOIN states s ON ho.state_id = s.id
      WHERE u.head_office_id IS NOT NULL AND ho.is_active = true
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    const userHoMap = {};
    uhoRows.forEach(row => {
      if (!userHoMap[row.user_id]) userHoMap[row.user_id] = [];
      if (!userHoMap[row.user_id].some(h => h.head_office_id === row.head_office_id)) {
        userHoMap[row.user_id].push({
          headOfficeId: row.head_office_id,
          headOfficeName: row.head_office_name,
          stateId: row.state_id,
          stateName: row.state_name
        });
      }
    });

    // Fetch all head office targets for this period
    const hoTargetQuery = monthInt
      ? 'SELECT * FROM sales_targets WHERE head_office_id IS NOT NULL AND target_month = :month AND target_year = :year'
      : 'SELECT * FROM sales_targets WHERE head_office_id IS NOT NULL AND target_year = :year';

    const hoTargets = await sequelize.query(hoTargetQuery, {
      replacements: userReplacements,
      type: sequelize.QueryTypes.SELECT
    });

    const hoTargetMap = {};
    hoTargets.forEach(st => {
      hoTargetMap[st.head_office_id] = st;
    });

    // Fetch all head offices with state mapping for hierarchy aggregation
    const allHeadOffices = await sequelize.query(`
      SELECT id, name, state_id FROM head_offices WHERE is_active = true
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    const transformedUserTargets = activeUsers.map(user => {
      const assignedHos = userHoMap[user.user_id] || [];
      const userRole = user.role;

      // 1. Calculate Own Target (Sum of directly assigned Head Offices)
      let ownTargetAmount = 0;
      let ownAchievedAmount = 0;
      let deadline = null;
      let targetStatus = 'Unassigned';
      let primaryTargetId = null;

      assignedHos.forEach(ho => {
        const target = hoTargetMap[ho.headOfficeId];
        if (target) {
          ownTargetAmount += parseFloat(target.target_amount || 0);
          ownAchievedAmount += parseFloat(target.achieved_amount || 0);
          if (!deadline || (target.completion_deadline && new Date(target.completion_deadline) < new Date(deadline))) {
            deadline = target.completion_deadline;
          }
          if (!primaryTargetId) primaryTargetId = target.id;
        }
      });

      // 2. Calculate Team / Hierarchical Target
      let teamTargetAmount = ownTargetAmount;
      let teamAchievedAmount = ownAchievedAmount;

      if (userRole === 'State Head' && user.state_id) {
        // State Head: Sum of ALL head offices in this State
        const stateHos = allHeadOffices.filter(ho => ho.state_id === user.state_id);
        let stateTargetSum = 0;
        let stateAchievedSum = 0;
        stateHos.forEach(ho => {
          const target = hoTargetMap[ho.id];
          if (target) {
            stateTargetSum += parseFloat(target.target_amount || 0);
            stateAchievedSum += parseFloat(target.achieved_amount || 0);
            if (!primaryTargetId) primaryTargetId = target.id;
          }
        });
        teamTargetAmount = stateTargetSum;
        teamAchievedAmount = stateAchievedSum;
      } else if (['Admin', 'Super Admin', 'National Head'].includes(userRole)) {
        // Admin / Super Admin / National Head: Sum of all Head Offices
        let totalSum = 0;
        let totalAchieved = 0;
        allHeadOffices.forEach(ho => {
          const target = hoTargetMap[ho.id];
          if (target) {
            totalSum += parseFloat(target.target_amount || 0);
            totalAchieved += parseFloat(target.achieved_amount || 0);
          }
        });
        teamTargetAmount = totalSum;
        teamAchievedAmount = totalAchieved;
      } else if (userRole === 'Manager' || userRole === 'Area Manager' || userRole === 'Zonal Manager') {
        // Managers: Sum of assigned Head Offices
        teamTargetAmount = ownTargetAmount;
        teamAchievedAmount = ownAchievedAmount;
      }

      const ownPercentage = ownTargetAmount > 0 ? Math.round((ownAchievedAmount / ownTargetAmount) * 100) : 0;
      const teamPercentage = teamTargetAmount > 0 ? Math.round((teamAchievedAmount / teamTargetAmount) * 100) : 0;

      if (teamTargetAmount > 0) {
        targetStatus = teamPercentage >= 100 ? 'Completed' : 'Active';
      }

      return {
        _id: primaryTargetId || user.user_id,
        targetId: primaryTargetId,
        userId: {
          _id: user.user_id,
          id: user.user_id,
          name: user.name,
          employeeCode: user.employee_code,
          role: user.role,
          email: user.email
        },
        stateId: user.state_id,
        stateName: user.state_name || 'N/A',
        headOffices: assignedHos,
        headOfficeCount: assignedHos.length,
        targetMonth: monthInt || (new Date().getMonth() + 1),
        targetYear: yearInt,
        // Individual / Own HO Target
        targetAmount: ownTargetAmount,
        achievedAmount: ownAchievedAmount,
        achievementPercentage: ownPercentage,
        // Aggregated / Team / State Target
        aggregatedTargetAmount: teamTargetAmount,
        aggregatedAchievedAmount: teamAchievedAmount,
        aggregatedPercentage: teamPercentage,
        completionDeadline: deadline,
        status: targetStatus,
        hasTarget: teamTargetAmount > 0
      };
    });

    let filteredUsers = transformedUserTargets;
    if (status) {
      filteredUsers = filteredUsers.filter(u => u.status === status);
    }

    const totalTargetSum = filteredUsers.reduce((sum, u) => sum + u.aggregatedTargetAmount, 0);
    const totalAchievedSum = filteredUsers.reduce((sum, u) => sum + u.aggregatedAchievedAmount, 0);
    const overallPercentage = totalTargetSum > 0 ? Math.round((totalAchievedSum / totalTargetSum) * 100) : 0;

    return res.json({
      success: true,
      viewMode: 'user',
      data: filteredUsers,
      summary: {
        totalUsers: filteredUsers.length,
        totalTargetAmount: totalTargetSum,
        totalAchievedAmount: totalAchievedSum,
        overallAchievementPercentage: overallPercentage
      },
      pagination: {
        current: parseInt(page),
        pages: 1,
        total: filteredUsers.length
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

/**
 * CREATE a new sales target (by Head Office or User)
 */
const createSalesTarget = async (req, res) => {
  const sequelize = getSequelize(req);
  const models = getModels(req);
  const transaction = await sequelize.transaction();

  try {
    if (!['Admin', 'Super Admin'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admin can assign targets'
      });
    }

    const {
      headOfficeId,
      userId,
      targetAmount,
      targetMonth,
      targetYear,
      completionDeadline,
      notes
    } = req.body;

    if ((!headOfficeId && !userId) || !targetAmount || !targetMonth || !targetYear || !completionDeadline) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Head Office or User, Target Amount, Month, Year, and Deadline are required'
      });
    }

    const monthInt = parseInt(targetMonth);
    const yearInt = parseInt(targetYear);
    const amountFloat = parseFloat(targetAmount);

    let targetRecord;

    if (headOfficeId) {
      // 1. Check if target exists for this Head Office and Period
      const existingHoTarget = await models.SalesTarget.findOne({
        where: {
          head_office_id: headOfficeId,
          target_month: monthInt,
          target_year: yearInt
        },
        transaction
      });

      if (existingHoTarget) {
        // Update existing HO target
        existingHoTarget.target_amount = amountFloat;
        existingHoTarget.completion_deadline = new Date(completionDeadline);
        if (notes !== undefined) existingHoTarget.notes = notes;
        existingHoTarget.updated_by = req.user.id;
        await existingHoTarget.save({ transaction });
        targetRecord = existingHoTarget;
      } else {
        // Create new HO target
        targetRecord = await models.SalesTarget.create({
          head_office_id: headOfficeId,
          target_amount: amountFloat,
          target_month: monthInt,
          target_year: yearInt,
          completion_deadline: new Date(completionDeadline),
          notes,
          created_by: req.user.id,
          updated_by: req.user.id
        }, { transaction });
      }

      // 2. Find all active users assigned to this head office and sync their target records
      const assignedUsers = await sequelize.query(`
        SELECT DISTINCT user_id FROM user_head_offices WHERE head_office_id = :headOfficeId
        UNION
        SELECT DISTINCT id as user_id FROM users WHERE head_office_id = :headOfficeId AND is_active = true
      `, {
        replacements: { headOfficeId },
        type: sequelize.QueryTypes.SELECT,
        transaction
      });

      for (const u of assignedUsers) {
        const existingUserTarget = await models.SalesTarget.findOne({
          where: {
            user_id: u.user_id,
            target_month: monthInt,
            target_year: yearInt
          },
          transaction
        });

        if (existingUserTarget) {
          existingUserTarget.target_amount = amountFloat;
          existingUserTarget.head_office_id = headOfficeId;
          existingUserTarget.completion_deadline = new Date(completionDeadline);
          existingUserTarget.updated_by = req.user.id;
          await existingUserTarget.save({ transaction });
        } else {
          await models.SalesTarget.create({
            user_id: u.user_id,
            head_office_id: headOfficeId,
            target_amount: amountFloat,
            target_month: monthInt,
            target_year: yearInt,
            completion_deadline: new Date(completionDeadline),
            notes,
            created_by: req.user.id,
            updated_by: req.user.id
          }, { transaction });
        }
      }
    } else if (userId) {
      // Single user direct assignment
      const existingUserTarget = await models.SalesTarget.findOne({
        where: {
          user_id: userId,
          target_month: monthInt,
          target_year: yearInt
        },
        transaction
      });

      if (existingUserTarget) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Target already exists for this user for ${targetMonth}/${targetYear}`
        });
      }

      targetRecord = await models.SalesTarget.create({
        user_id: userId,
        target_amount: amountFloat,
        target_month: monthInt,
        target_year: yearInt,
        completion_deadline: new Date(completionDeadline),
        notes,
        created_by: req.user.id,
        updated_by: req.user.id
      }, { transaction });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Sales target assigned successfully',
      data: targetRecord
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Create sales target error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * UPDATE a sales target
 */
const updateSalesTarget = async (req, res) => {
  const sequelize = getSequelize(req);
  const models = getModels(req);
  const transaction = await sequelize.transaction();

  try {
    if (!['Admin', 'Super Admin'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { targetAmount, completionDeadline, notes, achievedAmount, status } = req.body;
    const target = await models.SalesTarget.findByPk(req.params.id, { transaction });

    if (!target) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }

    if (targetAmount !== undefined) target.target_amount = parseFloat(targetAmount);
    if (completionDeadline) target.completion_deadline = new Date(completionDeadline);
    if (notes !== undefined) target.notes = notes;
    if (achievedAmount !== undefined) target.achieved_amount = parseFloat(achievedAmount);
    if (status) target.status = status;

    if (target.target_amount > 0 && target.achieved_amount !== undefined) {
      target.achievement_percentage = Math.round((target.achieved_amount / target.target_amount) * 100);
      if (target.achievement_percentage >= 100) target.status = 'Completed';
    }

    target.updated_by = req.user.id;
    await target.save({ transaction });

    // If this is a Head Office target, sync target_amount and deadline to linked user records
    if (target.head_office_id) {
      await models.SalesTarget.update({
        target_amount: target.target_amount,
        completion_deadline: target.completion_deadline,
        updated_by: req.user.id
      }, {
        where: {
          head_office_id: target.head_office_id,
          target_month: target.target_month,
          target_year: target.target_year
        },
        transaction
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: 'Sales target updated successfully',
      data: target
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

/**
 * DELETE a sales target
 */
const deleteSalesTarget = async (req, res) => {
  const models = getModels(req);
  const sequelize = getSequelize(req);
  const transaction = await sequelize.transaction();

  try {
    if (!['Admin', 'Super Admin'].includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const target = await models.SalesTarget.findByPk(req.params.id, { transaction });
    if (!target) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }

    // If it's an HO target, delete all linked records for that HO/month/year
    if (target.head_office_id) {
      await models.SalesTarget.destroy({
        where: {
          head_office_id: target.head_office_id,
          target_month: target.target_month,
          target_year: target.target_year
        },
        transaction
      });
    } else {
      await target.destroy({ transaction });
    }

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

/**
 * UPDATE achievement amount on a target
 */
const updateTargetAchievement = async (req, res) => {
  const models = getModels(req);
  const sequelize = getSequelize(req);
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

    const target = await models.SalesTarget.findByPk(req.params.id, { transaction });
    if (!target) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales target not found'
      });
    }

    target.achieved_amount = parseFloat(achievedAmount);
    if (target.target_amount > 0) {
      target.achievement_percentage = Math.round((target.achieved_amount / target.target_amount) * 100);
    }

    const now = new Date();
    if (target.achievement_percentage >= 100) {
      target.status = 'Completed';
    } else if (now > new Date(target.completion_deadline)) {
      target.status = 'Overdue';
    } else {
      target.status = 'Active';
    }

    target.updated_by = req.user.id;
    await target.save({ transaction });

    // If Head Office target, update linked records
    if (target.head_office_id) {
      await models.SalesTarget.update({
        achieved_amount: target.achieved_amount,
        achievement_percentage: target.achievement_percentage,
        status: target.status,
        updated_by: req.user.id
      }, {
        where: {
          head_office_id: target.head_office_id,
          target_month: target.target_month,
          target_year: target.target_year
        },
        transaction
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: 'Achievement updated successfully',
      data: target
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Update achievement error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * GET current logged-in user's sales targets (My Targets)
 */
const getMyTargets = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const userId = req.user.id;
    const userRole = req.user.role;
    const { year = new Date().getFullYear() } = req.query;
    const yearInt = parseInt(year);

    let targets = [];

    if (userRole === 'State Head') {
      // Find State Head's state_id
      const [u] = await sequelize.query(`SELECT state_id FROM users WHERE id = :userId`, {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      });

      if (u && u.state_id) {
        // Aggregate all HO targets in this state by month
        targets = await sequelize.query(`
          SELECT 
            st.target_month,
            st.target_year,
            SUM(st.target_amount) as target_amount,
            SUM(st.achieved_amount) as achieved_amount,
            MAX(st.completion_deadline) as completion_deadline,
            MAX(st.id) as _id,
            MAX(st.id) as id
          FROM sales_targets st
          JOIN head_offices ho ON st.head_office_id = ho.id
          WHERE ho.state_id = :stateId AND st.target_year = :year
          GROUP BY st.target_month, st.target_year
          ORDER BY st.target_month ASC
        `, {
          replacements: { stateId: u.state_id, year: yearInt },
          type: sequelize.QueryTypes.SELECT
        });
      }
    } else {
      // Regular user or Manager: get targets for assigned Head Offices or direct user targets
      targets = await sequelize.query(`
        SELECT DISTINCT
          st.id as _id,
          st.id,
          st.target_month,
          st.target_year,
          st.target_amount,
          st.achieved_amount,
          st.achievement_percentage,
          st.completion_deadline,
          st.status,
          st.notes,
          ho.name as head_office_name
        FROM sales_targets st
        LEFT JOIN head_offices ho ON st.head_office_id = ho.id
        WHERE (
          st.user_id = :userId 
          OR st.head_office_id IN (
            SELECT head_office_id FROM user_head_offices WHERE user_id = :userId
            UNION
            SELECT head_office_id FROM users WHERE id = :userId AND head_office_id IS NOT NULL
          )
        )
        AND st.target_year = :year
        ORDER BY st.target_month ASC
      `, {
        replacements: { userId, year: yearInt },
        type: sequelize.QueryTypes.SELECT
      });
    }

    const transformed = targets.map(t => {
      const targetAmount = parseFloat(t.target_amount) || 0;
      const achievedAmount = parseFloat(t.achieved_amount) || 0;
      const percentage = targetAmount > 0 ? Math.round((achievedAmount / targetAmount) * 100) : 0;
      let status = t.status || (percentage >= 100 ? 'Completed' : 'Active');

      return {
        _id: t._id || t.id,
        targetMonth: parseInt(t.target_month),
        targetYear: parseInt(t.target_year),
        targetAmount,
        achievedAmount,
        achievementPercentage: percentage,
        completionDeadline: t.completion_deadline,
        status,
        headOfficeName: t.head_office_name || '',
        notes: t.notes || ''
      };
    });

    res.json({
      success: true,
      data: transformed
    });
  } catch (error) {
    console.error('Get my targets error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * GET Sales Targets Dashboard Data (Summary Cards & Widgets)
 */
const getDashboardData = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const targets = await sequelize.query(`
      SELECT 
        st.id,
        st.target_amount,
        st.achieved_amount,
        st.achievement_percentage,
        st.status,
        ho.name as head_office_name,
        s.name as state_name
      FROM sales_targets st
      LEFT JOIN head_offices ho ON st.head_office_id = ho.id
      LEFT JOIN states s ON ho.state_id = s.id
      WHERE st.target_month = :currentMonth AND st.target_year = :currentYear
    `, {
      replacements: { currentMonth, currentYear },
      type: sequelize.QueryTypes.SELECT
    });

    const totalTargets = targets.length;
    const totalTargetAmount = targets.reduce((sum, t) => sum + parseFloat(t.target_amount || 0), 0);
    const totalAchievedAmount = targets.reduce((sum, t) => sum + parseFloat(t.achieved_amount || 0), 0);
    const overallAchievementPercentage = totalTargetAmount > 0 
      ? Math.round((totalAchievedAmount / totalTargetAmount) * 100)
      : 0;

    const completedTargets = targets.filter(t => t.status === 'Completed').length;
    const activeTargets = targets.filter(t => t.status === 'Active' || !t.status).length;
    const overdueTargets = targets.filter(t => t.status === 'Overdue').length;

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
        currentMonthTargets: targets
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

/**
 * GET target by ID
 */
const getSalesTargetById = async (req, res) => {
  try {
    const models = getModels(req);
    const target = await models.SalesTarget.findByPk(req.params.id, {
      include: [
        { model: models.User, as: 'salesTargetUser', attributes: ['id', 'name', 'email', 'employee_code', 'role'] },
        { model: models.HeadOffice, as: 'salesTargetHeadOffice', attributes: ['id', 'name', 'state_id'] }
      ]
    });

    if (!target) {
      return res.status(404).json({ success: false, message: 'Sales target not found' });
    }

    res.json({ success: true, data: target });
  } catch (error) {
    console.error('Get sales target by ID error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET targets for a specific user
 */
const getTargetsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year = new Date().getFullYear() } = req.query;
    const sequelize = getSequelize(req);

    const targets = await sequelize.query(`
      SELECT 
        st.*,
        ho.name as head_office_name
      FROM sales_targets st
      LEFT JOIN head_offices ho ON st.head_office_id = ho.id
      WHERE (
        st.user_id = :userId
        OR st.head_office_id IN (
          SELECT head_office_id FROM user_head_offices WHERE user_id = :userId
          UNION
          SELECT head_office_id FROM users WHERE id = :userId AND head_office_id IS NOT NULL
        )
      )
      AND st.target_year = :year
      ORDER BY st.target_month ASC
    `, {
      replacements: { userId, year: parseInt(year) },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({ success: true, data: targets });
  } catch (error) {
    console.error('Get targets by user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
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