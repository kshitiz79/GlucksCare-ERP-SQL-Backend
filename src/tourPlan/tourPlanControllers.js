const ROLE_HIERARCHY = {
  'User': 1,
  'MR': 1,
  'Manager': 2,
  'Area Manager': 3,
  'Zonal Manager': 4,
  'State Head': 5,
  'National Head': 6,
  'Admin': 7,
  'Super Admin': 8
};

/**
 * Helper to enrich tour plan days with full joint work user objects (id, name, role, employee_code)
 */
const enrichTourPlanDaysWithJointUsers = async (daysOrDay, User) => {
  if (!daysOrDay) return daysOrDay;
  const isArray = Array.isArray(daysOrDay);
  const rawDays = isArray ? daysOrDay : [daysOrDay];

  const plainDays = rawDays.map(d => (d && typeof d.toJSON === 'function' ? d.toJSON() : JSON.parse(JSON.stringify(d))));

  const userIds = new Set();
  plainDays.forEach(day => {
    if (day) {
      if (Array.isArray(day.joint_work_user_ids)) {
        day.joint_work_user_ids.forEach(id => {
          if (id) userIds.add(id);
        });
      }
      if (day.joint_work_with_user_id) {
        userIds.add(day.joint_work_with_user_id);
      }
    }
  });

  const userMap = new Map();
  if (userIds.size > 0 && User) {
    const users = await User.findAll({
      where: { id: Array.from(userIds) },
      attributes: ['id', 'name', 'role', 'employee_code']
    });
    users.forEach(u => {
      userMap.set(u.id, {
        id: u.id,
        name: u.name,
        role: u.role,
        employee_code: u.employee_code || null
      });
    });
  }

  plainDays.forEach(day => {
    if (day) {
      const ids = Array.isArray(day.joint_work_user_ids) && day.joint_work_user_ids.length > 0
        ? day.joint_work_user_ids
        : (day.joint_work_with_user_id ? [day.joint_work_with_user_id] : []);

      const jointUsers = ids.map(id => {
        if (userMap.has(id)) {
          return userMap.get(id);
        }
        if (day.jointWorkWith && day.jointWorkWith.id === id) {
          return {
            id: day.jointWorkWith.id,
            name: day.jointWorkWith.name,
            role: day.jointWorkWith.role,
            employee_code: day.jointWorkWith.employee_code || null
          };
        }
        return { id, name: 'Colleague', role: '-' };
      });

      day.joint_work_users = jointUsers;
      day.jointWorkUsers = jointUsers;
      if (!day.joint_work_user_ids || !Array.isArray(day.joint_work_user_ids)) {
        day.joint_work_user_ids = ids;
      }
    }
  });

  return isArray ? plainDays : plainDays[0];
};

/**
 * Helper to enrich tour plan(s) and their nested days with full joint work user objects
 */
const enrichTourPlansWithJointUsers = async (plansOrPlan, User) => {
  if (!plansOrPlan) return plansOrPlan;
  const isArray = Array.isArray(plansOrPlan);
  const rawPlans = isArray ? plansOrPlan : [plansOrPlan];

  const plainPlans = rawPlans.map(p => (p && typeof p.toJSON === 'function' ? p.toJSON() : JSON.parse(JSON.stringify(p))));

  for (const plan of plainPlans) {
    if (plan && Array.isArray(plan.days) && plan.days.length > 0) {
      plan.days = await enrichTourPlanDaysWithJointUsers(plan.days, User);
    }
  }

  return isArray ? plainPlans : plainPlans[0];
};

// GET my tour plans
const getMyPlans = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.TourPlan) {
      throw new Error('Required models are not available');
    }
    const { TourPlan, TourPlanDay, Beat, User } = models;

    const plans = await TourPlan.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: TourPlanDay,
          as: 'days',
          include: [
            { model: Beat, as: 'beat1', attributes: ['id', 'name'] },
            { model: Beat, as: 'beat2', attributes: ['id', 'name'] },
            { model: User, as: 'jointWorkWith', attributes: ['id', 'name', 'role'] }
          ]
        }
      ],
      order: [
        ['year', 'DESC'],
        ['month', 'DESC'],
        [{ model: TourPlanDay, as: 'days' }, 'date', 'ASC']
      ]
    });

    const enrichedPlans = await enrichTourPlansWithJointUsers(plans, User);

    res.json({
      success: true,
      data: enrichedPlans
    });
  } catch (error) {
    console.error('Get my plans error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET a specific tour plan by ID
const getPlanById = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.TourPlan) {
      throw new Error('Required models are not available');
    }
    const { TourPlan, TourPlanDay, User, Beat } = models;

    const plan = await TourPlan.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'role', 'employee_code']
        },
        {
          model: TourPlanDay,
          as: 'days',
          include: [
            { model: Beat, as: 'beat1', attributes: ['id', 'name'] },
            { model: Beat, as: 'beat2', attributes: ['id', 'name'] },
            { model: User, as: 'jointWorkWith', attributes: ['id', 'name', 'role'] }
          ]
        }
      ],
      order: [
        [{ model: TourPlanDay, as: 'days' }, 'date', 'ASC']
      ]
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan not found'
      });
    }

    const enrichedPlan = await enrichTourPlansWithJointUsers(plan, User);

    res.json({
      success: true,
      data: enrichedPlan
    });
  } catch (error) {
    console.error('Get plan by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// SAVE draft monthly tour plan
const saveDraft = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  const models = req.app.get('models');
  if (!models || !models.TourPlan || !models.TourPlanDay || !sequelize) {
    return res.status(500).json({
      success: false,
      message: 'Database models or instance not initialized'
    });
  }

  const { TourPlan, TourPlanDay, Beat, User } = models;
  const { month, year, days } = req.body;

  if (!month || !year) {
    return res.status(400).json({
      success: false,
      message: 'Month and year are required'
    });
  }

  const transaction = await sequelize.transaction();

  try {
    // Check if plan already exists for the month and year
    let plan = await TourPlan.findOne({
      where: {
        user_id: req.user.id,
        month,
        year
      },
      transaction
    });

    if (plan) {
      // Cannot modify submitted or approved plans
      if (['Submitted', 'Approved'].includes(plan.status)) {
        throw new Error(`Cannot modify plan that is already ${plan.status}`);
      }
      // Keep comments and draft/returned status intact (except reset comments on re-save)
      if (plan.status === 'Returned') {
        plan.status = 'Draft';
      }
      await plan.save({ transaction });
    } else {
      // Create new plan
      plan = await TourPlan.create({
        user_id: req.user.id,
        month,
        year,
        status: 'Draft'
      }, { transaction });
    }

    // Delete old day entries
    await TourPlanDay.destroy({
      where: { tour_plan_id: plan.id },
      transaction
    });

    // Bulk create new day entries
    if (days && Array.isArray(days) && days.length > 0) {
      const dayRecords = days.map(d => {
        const userIds = d.day_type === 'Joint work'
          ? (Array.isArray(d.joint_work_user_ids) && d.joint_work_user_ids.length > 0
            ? d.joint_work_user_ids
            : (d.joint_work_with_user_id ? [d.joint_work_with_user_id] : []))
          : [];

        return {
          tour_plan_id: plan.id,
          date: d.date,
          day_type: d.day_type || 'Field',
          beat_id_1: d.beat_id_1 || null,
          beat_id_2: d.beat_id_2 || null,
          joint_work_with_user_id: userIds[0] || null,
          joint_work_user_ids: userIds,
          collaboration_status: d.day_type === 'Joint work' && userIds.length > 0 ? (d.collaboration_status && d.collaboration_status !== 'None' ? d.collaboration_status : 'Pending') : 'None',
          notes: d.notes || null
        };
      });

      await TourPlanDay.bulkCreate(dayRecords, { transaction });
    }

    await transaction.commit();

    // Fetch the updated plan with days to return
    const updatedPlan = await TourPlan.findByPk(plan.id, {
      include: [
        {
          model: TourPlanDay,
          as: 'days',
          include: [
            { model: Beat, as: 'beat1', attributes: ['id', 'name'] },
            { model: Beat, as: 'beat2', attributes: ['id', 'name'] },
            { model: User, as: 'jointWorkWith', attributes: ['id', 'name', 'role'] }
          ]
        }
      ],
      order: [
        [{ model: TourPlanDay, as: 'days' }, 'date', 'ASC']
      ]
    });

    const enrichedPlan = await enrichTourPlansWithJointUsers(updatedPlan, User);

    res.json({
      success: true,
      message: 'Draft saved successfully',
      data: enrichedPlan
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Save draft error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// SUBMIT tour plan for approval
const submitPlan = async (req, res) => {
  try {
    const { TourPlan } = req.app.get('models');
    const plan = await TourPlan.findByPk(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan not found'
      });
    }

    if (plan.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to submit this plan'
      });
    }

    if (['Submitted', 'Approved'].includes(plan.status)) {
      return res.status(400).json({
        success: false,
        message: `Plan is already ${plan.status}`
      });
    }

    plan.status = 'Submitted';
    await plan.save();

    res.json({
      success: true,
      message: 'Plan submitted successfully for approval',
      data: plan
    });
  } catch (error) {
    console.error('Submit plan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// APPROVE monthly tour plan (manager hierarchy check)
const approvePlan = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { TourPlan, User } = models;
    const plan = await TourPlan.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'role'] }]
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan not found'
      });
    }

    if (plan.status !== 'Submitted') {
      return res.status(400).json({
        success: false,
        message: `Plan status is ${plan.status}, must be Submitted to approve.`
      });
    }

    // Check role hierarchy: approver must be strictly higher than creator
    const creatorRank = ROLE_HIERARCHY[plan.user.role] || 0;
    const approverRank = ROLE_HIERARCHY[req.user.role] || 0;

    if (approverRank <= creatorRank) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Your role (${req.user.role}) is not authorized to approve plans for a ${plan.user.role}.`
      });
    }

    plan.status = 'Approved';
    plan.approved_by_id = req.user.id;
    plan.approved_by_name = req.user.name;
    plan.approved_by_role = req.user.role;
    plan.comments = req.body.comments || null;

    const sequelize = req.app.get('sequelize');
    const transaction = await sequelize.transaction();

    try {
      await plan.save({ transaction });

      // Update collaboration_status to 'Pending' for all 'Joint work' days with a collaborator
      const { TourPlanDay } = req.app.get('models');
      const { Op } = require('sequelize');
      await TourPlanDay.update(
        { collaboration_status: 'Pending' },
        {
          where: {
            tour_plan_id: plan.id,
            day_type: 'Joint work',
            joint_work_with_user_id: { [Op.ne]: null }
          },
          transaction
        }
      );

      await transaction.commit();

      // Trigger auto-scheduling of visits for the approved tour plan
      try {
        const { autoScheduleForApprovedPlan } = require('../utils/autoScheduler');
        autoScheduleForApprovedPlan(sequelize, models, plan).catch(err => {
          console.error('Error auto-scheduling visits for approved plan:', err);
        });
      } catch (schedErr) {
        console.error('Failed to load auto-scheduler after plan approval:', schedErr);
      }
    } catch (saveError) {
      await transaction.rollback();
      throw saveError;
    }

    res.json({
      success: true,
      message: 'Tour plan approved successfully',
      data: plan
    });
  } catch (error) {
    console.error('Approve plan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// RETURN monthly tour plan for correction
const returnPlan = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { TourPlan, User } = models;
    const plan = await TourPlan.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'role'] }]
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan not found'
      });
    }

    if (plan.status !== 'Submitted') {
      return res.status(400).json({
        success: false,
        message: `Plan status is ${plan.status}, must be Submitted to return.`
      });
    }

    const { comments } = req.body;
    if (!comments || comments.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Comments/reason are required when returning a plan.'
      });
    }

    // Check role hierarchy
    const creatorRank = ROLE_HIERARCHY[plan.user.role] || 0;
    const approverRank = ROLE_HIERARCHY[req.user.role] || 0;

    if (approverRank <= creatorRank) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Your role (${req.user.role}) is not authorized to return plans for a ${plan.user.role}.`
      });
    }

    plan.status = 'Returned';
    plan.comments = comments;
    await plan.save();

    res.json({
      success: true,
      message: 'Tour plan returned for correction successfully',
      data: plan
    });
  } catch (error) {
    console.error('Return plan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET pending approvals for the manager
const getPendingApprovals = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.TourPlan) {
      throw new Error('Required models are not available');
    }
    const { TourPlan, TourPlanDay, User, Beat } = models;

    // Get list of roles junior to the current user
    const approverRank = ROLE_HIERARCHY[req.user.role] || 0;
    const juniorRolesList = Object.keys(ROLE_HIERARCHY).filter(role => ROLE_HIERARCHY[role] < approverRank);

    const plans = await TourPlan.findAll({
      where: { status: 'Submitted' },
      include: [
        {
          model: User,
          as: 'user',
          where: { role: juniorRolesList },
          attributes: ['id', 'name', 'role', 'employee_code']
        },
        {
          model: TourPlanDay,
          as: 'days',
          include: [
            { model: Beat, as: 'beat1', attributes: ['id', 'name'] },
            { model: Beat, as: 'beat2', attributes: ['id', 'name'] },
            { model: User, as: 'jointWorkWith', attributes: ['id', 'name', 'role'] }
          ]
        }
      ],
      order: [
        ['year', 'DESC'],
        ['month', 'DESC'],
        [{ model: TourPlanDay, as: 'days' }, 'date', 'ASC']
      ]
    });

    const enrichedPlans = await enrichTourPlansWithJointUsers(plans, User);

    res.json({
      success: true,
      data: enrichedPlans
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET all tour plans (Admin only)
const getAllPlansAdmin = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.TourPlan) {
      throw new Error('Required models are not available');
    }
    const { TourPlan, TourPlanDay, User, Beat } = models;

    const plans = await TourPlan.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'role', 'employee_code']
        },
        {
          model: TourPlanDay,
          as: 'days',
          include: [
            { model: Beat, as: 'beat1', attributes: ['id', 'name'] },
            { model: Beat, as: 'beat2', attributes: ['id', 'name'] },
            { model: User, as: 'jointWorkWith', attributes: ['id', 'name', 'role'] }
          ]
        }
      ],
      order: [
        ['year', 'DESC'],
        ['month', 'DESC'],
        [{ model: TourPlanDay, as: 'days' }, 'date', 'ASC']
      ]
    });

    const enrichedPlans = await enrichTourPlansWithJointUsers(plans, User);

    res.json({
      success: true,
      data: enrichedPlans
    });
  } catch (error) {
    console.error('Get all plans admin error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET users availability for a date
const getUsersAvailability = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter (?date=YYYY-MM-DD) is required'
      });
    }

    const models = req.app.get('models');
    const { User, TourPlan, TourPlanDay } = models;
    const { Op } = require('sequelize');

    // 1. Fetch all active users who can participate in joint work
    const users = await User.findAll({
      where: {
        role: ['State Head', 'Zonal Manager', 'Area Manager', 'Manager', 'User'],
        id: { [Op.ne]: req.user.id },
        is_active: true
      },
      attributes: ['id', 'name', 'role', 'employee_code'],
      order: [['name', 'ASC']]
    });

    const userIds = users.map(u => u.id);

    // 2. Query busy days on this specific date
    const busyDays = await TourPlanDay.findAll({
      where: {
        date,
        [Op.or]: [
          // Case A: User has their own approved plan day with busy types
          {
            day_type: ['Leave', 'Weekly off', 'Holiday', 'Meeting'],
            '$tourPlan.status$': 'Approved'
          },
          // Case B: User has accepted joint work as the creator
          {
            day_type: 'Joint work',
            collaboration_status: 'Accepted',
            '$tourPlan.status$': 'Approved'
          },
          // Case C: User is the collaborator in an accepted joint work
          {
            joint_work_with_user_id: { [Op.in]: userIds },
            collaboration_status: 'Accepted'
          }
        ]
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          attributes: ['user_id', 'status']
        }
      ]
    });

    // Determine busy user IDs
    const busyUserIds = new Set();
    busyDays.forEach(day => {
      if (day.tourPlan && day.tourPlan.status === 'Approved') {
        busyUserIds.add(day.tourPlan.user_id);
      }
      if (day.collaboration_status === 'Accepted' && day.joint_work_with_user_id) {
        busyUserIds.add(day.joint_work_with_user_id);
      }
    });

    const result = users.map(u => ({
      id: u.id,
      _id: u.id,
      name: u.name,
      role: u.role,
      employeeCode: u.employee_code,
      available: !busyUserIds.has(u.id)
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get users availability error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET incoming pending collaboration requests
const getIncomingCollaborations = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { TourPlan, TourPlanDay, User } = models;
    const { Op } = require('sequelize');

    const incoming = await TourPlanDay.findAll({
      where: {
        collaboration_status: 'Pending',
        [Op.or]: [
          { joint_work_with_user_id: req.user.id },
          sequelize.literal(`joint_work_user_ids::jsonb @> '"${req.user.id}"'::jsonb`)
        ]
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'role', 'employee_code']
            }
          ]
        }
      ],
      order: [['date', 'ASC']]
    });

    const enrichedIncoming = await enrichTourPlanDaysWithJointUsers(incoming, User);

    res.json({
      success: true,
      data: enrichedIncoming
    });
  } catch (error) {
    console.error('Get incoming collaborations error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET accepted collaborations for the logged-in user
const getAcceptedCollaborations = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { TourPlan, TourPlanDay, User } = models;
    const { Op } = require('sequelize');

    const accepted = await TourPlanDay.findAll({
      where: {
        collaboration_status: 'Accepted',
        [Op.or]: [
          { joint_work_with_user_id: req.user.id },
          sequelize.literal(`joint_work_user_ids::jsonb @> '"${req.user.id}"'::jsonb`)
        ]
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'role', 'employee_code']
            }
          ]
        }
      ],
      order: [['date', 'ASC']]
    });

    const enrichedAccepted = await enrichTourPlanDaysWithJointUsers(accepted, User);

    res.json({
      success: true,
      data: enrichedAccepted
    });
  } catch (error) {
    console.error('Get accepted collaborations error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// POST send a collaboration request to a target user (defaults to current date if date omitted)
const sendCollaborationRequest = async (req, res) => {
  try {
    const { target_user_id, target_user_ids, date, notes } = req.body;

    const recipientIds = Array.isArray(target_user_ids) && target_user_ids.length > 0
      ? target_user_ids
      : (target_user_id ? [target_user_id] : []);

    if (recipientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'target_user_id or target_user_ids is required'
      });
    }

    const models = req.app.get('models');
    const { TourPlan, TourPlanDay, User, Beat } = models;

    // Verify recipient user(s) exist in the database
    const validUsers = await User.findAll({
      where: { id: recipientIds },
      attributes: ['id']
    });

    if (validUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid target_user_id or target_user_ids. User(s) not found in the database.'
      });
    }

    const validUserIds = validUsers.map(u => u.id);

    // Use provided date or default to current date (today) in YYYY-MM-DD format
    let targetDateStr = date;
    if (!targetDateStr) {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const monthNum = currentDate.getMonth() + 1;
      const day = String(currentDate.getDate()).padStart(2, '0');
      const monthStr = String(monthNum).padStart(2, '0');
      targetDateStr = `${year}-${monthStr}-${day}`;
    }

    const [yearStr, monthStr] = targetDateStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // 1. Find or create TourPlan for logged in user for this month/year
    const [tourPlan] = await TourPlan.findOrCreate({
      where: {
        user_id: req.user.id,
        month: month,
        year: year
      },
      defaults: {
        user_id: req.user.id,
        month: month,
        year: year,
        status: 'Approved'
      }
    });

    // 2. Find or create TourPlanDay for logged in user for targetDateStr
    let [planDay] = await TourPlanDay.findOrCreate({
      where: {
        tour_plan_id: tourPlan.id,
        date: targetDateStr
      },
      defaults: {
        tour_plan_id: tourPlan.id,
        date: targetDateStr,
        day_type: 'Joint work',
        joint_work_with_user_id: validUserIds[0],
        joint_work_user_ids: validUserIds,
        collaboration_status: 'Pending',
        handshake_status: 'None'
      }
    });

    // 3. Update day record with joint work details
    planDay.day_type = 'Joint work';
    planDay.joint_work_with_user_id = validUserIds[0];
    planDay.joint_work_user_ids = validUserIds;
    planDay.collaboration_status = 'Pending';
    planDay.handshake_status = 'None';
    if (notes !== undefined) {
      planDay.notes = notes;
    }
    await planDay.save();

    // 4. Fetch populated day details with partner user and all target users
    const updatedDay = await TourPlanDay.findByPk(planDay.id, {
      include: [
        {
          model: User,
          as: 'jointWorkWith',
          attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role']
        },
        {
          model: Beat,
          as: 'beat1',
          attributes: ['id', 'name', 'color']
        }
      ]
    });

    const targetUsers = await User.findAll({
      where: { id: validUserIds },
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role']
    });

    const responseData = {
      ...updatedDay.toJSON(),
      target_users: targetUsers
    };

    res.json({
      success: true,
      message: `Collaboration request sent successfully for ${targetDateStr}`,
      data: responseData
    });
  } catch (error) {
    console.error('Send collaboration request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send collaboration request'
    });
  }
};

// POST respond to a collaboration request (accept/reject)
const respondToCollaboration = async (req, res) => {
  try {
    const { dayId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either accept or reject'
      });
    }

    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { TourPlanDay, TourPlan } = models;
    const { Op } = require('sequelize');

    const day = await TourPlanDay.findOne({
      where: {
        id: dayId,
        collaboration_status: 'Pending',
        [Op.or]: [
          { joint_work_with_user_id: req.user.id },
          sequelize.literal(`COALESCE(joint_work_user_ids, '[]'::jsonb)::jsonb @> '"${req.user.id}"'::jsonb`)
        ]
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan'
        }
      ]
    });

    if (!day) {
      return res.status(404).json({
        success: false,
        message: 'Pending collaboration request not found for this day'
      });
    }

    if (action === 'accept') {
      const targetDate = day.date;
      const senderUserId = day.tourPlan.user_id;
      const acceptorUserId = req.user.id;

      // 1. Replace existing accepted collaborations for Sender (User A) on targetDate with anyone else
      const senderOtherDays = await TourPlanDay.findAll({
        where: {
          id: { [Op.ne]: day.id },
          date: targetDate,
          collaboration_status: 'Accepted'
        },
        include: [{
          model: TourPlan,
          as: 'tourPlan',
          where: { user_id: senderUserId }
        }]
      });
      for (const d of senderOtherDays) {
        d.collaboration_status = 'Rejected';
        await d.save();
      }

      await TourPlanDay.update(
        { collaboration_status: 'Rejected' },
        {
          where: {
            id: { [Op.ne]: day.id },
            date: targetDate,
            collaboration_status: 'Accepted',
            [Op.or]: [
              { joint_work_with_user_id: senderUserId },
              sequelize.literal(`COALESCE(joint_work_user_ids, '[]'::jsonb)::jsonb @> '"${senderUserId}"'::jsonb`)
            ]
          }
        }
      );

      // 2. Replace existing accepted collaborations for Acceptor (User B) on targetDate with anyone else
      const acceptorOtherDays = await TourPlanDay.findAll({
        where: {
          id: { [Op.ne]: day.id },
          date: targetDate,
          collaboration_status: 'Accepted'
        },
        include: [{
          model: TourPlan,
          as: 'tourPlan',
          where: { user_id: acceptorUserId }
        }]
      });
      for (const d of acceptorOtherDays) {
        d.collaboration_status = 'Rejected';
        await d.save();
      }

      await TourPlanDay.update(
        { collaboration_status: 'Rejected' },
        {
          where: {
            id: { [Op.ne]: day.id },
            date: targetDate,
            collaboration_status: 'Accepted',
            [Op.or]: [
              { joint_work_with_user_id: acceptorUserId },
              sequelize.literal(`COALESCE(joint_work_user_ids, '[]'::jsonb)::jsonb @> '"${acceptorUserId}"'::jsonb`)
            ]
          }
        }
      );

      // 3. Mark current request as Accepted
      day.collaboration_status = 'Accepted';
      day.handshake_status = 'None';
      await day.save();

      // 4. Synchronize Acceptor's (User B's) own TourPlanDay on targetDate if present
      const [yearStr, monthStr] = targetDate.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const acceptorPlan = await TourPlan.findOne({
        where: { user_id: acceptorUserId, month, year }
      });

      if (acceptorPlan) {
        const acceptorDay = await TourPlanDay.findOne({
          where: { tour_plan_id: acceptorPlan.id, date: targetDate }
        });
        if (acceptorDay) {
          acceptorDay.day_type = 'Joint work';
          acceptorDay.joint_work_with_user_id = senderUserId;
          acceptorDay.joint_work_user_ids = [senderUserId];
          acceptorDay.collaboration_status = 'Accepted';
          acceptorDay.handshake_status = 'None';
          await acceptorDay.save();
        }
      }
    } else {
      day.collaboration_status = 'Rejected';
      await day.save();
    }

    res.json({
      success: true,
      message: `Collaboration request successfully ${action}ed. Any previous collaboration for this date has been replaced.`,
      data: day
    });
  } catch (error) {
    console.error('Respond to collaboration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// POST send/update joint work collaboration request for a day directly
const updateDayCollaboration = async (req, res) => {
  try {
    const { dayId } = req.params;
    const { joint_work_user_ids, notes } = req.body;

    const models = req.app.get('models');
    const { TourPlanDay, TourPlan } = models;

    const day = await TourPlanDay.findByPk(dayId, {
      include: [{
        model: TourPlan,
        as: 'tourPlan'
      }]
    });

    if (!day) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan day not found'
      });
    }

    if (day.tourPlan.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. You can only manage joint work for your own tour plan.'
      });
    }

    const userIds = Array.isArray(joint_work_user_ids) ? joint_work_user_ids : [];

    day.joint_work_user_ids = userIds;
    day.joint_work_with_user_id = userIds[0] || null;
    if (userIds.length > 0) {
      day.day_type = 'Joint work';
      day.collaboration_status = 'Pending';
    } else {
      day.collaboration_status = 'None';
    }
    if (notes !== undefined) {
      day.notes = notes;
    }

    await day.save();

    res.json({
      success: true,
      message: userIds.length > 0 ? 'Collaboration request sent successfully!' : 'Joint work updated.',
      data: day
    });
  } catch (error) {
    console.error('Update day collaboration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// POST send same-day change request
const requestDayChange = async (req, res) => {
  try {
    const { dayId } = req.params;
    const { reason, beat_id_1, beat_id_2, day_type } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for a change request'
      });
    }

    const models = req.app.get('models');
    const { TourPlanDay, TourPlan, Beat, DoctorVisit, ChemistVisit, StockistVisit } = models;
    const sequelize = req.app.get('sequelize');

    // Find the day and verify ownership
    const day = await TourPlanDay.findByPk(dayId, {
      include: [{
        model: TourPlan,
        as: 'tourPlan'
      }]
    });

    if (!day) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan day not found'
      });
    }

    if (day.tourPlan.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. You can only request changes for your own tour plan.'
      });
    }

    if (day.tourPlan.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot request changes on a plan that is not Approved'
      });
    }

    // Validate that date is not in the past
    const todayStr = new Date().toISOString().split('T')[0];
    if (day.date < todayStr) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request changes for past dates'
      });
    }

    // Optional validations for beats if provided
    if (beat_id_1) {
      const beat1 = await Beat.findByPk(beat_id_1);
      if (!beat1) {
        return res.status(404).json({ success: false, message: 'Requested Beat 1 not found' });
      }
    }
    if (beat_id_2) {
      const beat2 = await Beat.findByPk(beat_id_2);
      if (!beat2) {
        return res.status(404).json({ success: false, message: 'Requested Beat 2 not found' });
      }
    }

    const currentDirectCount = day.tourPlan.direct_changes_count || 0;

    if (currentDirectCount < 3) {
      // Direct Change Allowed (Auto-Approved)
      day.beat_id_1 = beat_id_1 || null;
      day.beat_id_2 = beat_id_2 || null;
      day.day_type = day_type || 'Field';
      day.change_request_status = 'Approved';
      day.change_request_reason = reason;
      day.change_request_beat_id_1 = beat_id_1 || null;
      day.change_request_beat_id_2 = beat_id_2 || null;
      day.change_request_day_type = day_type || 'Field';
      day.change_request_comments = 'Auto-approved (Direct monthly change allowance)';

      await day.save();

      // Increment direct_changes_count on tourPlan
      day.tourPlan.direct_changes_count = currentDirectCount + 1;
      await day.tourPlan.save();

      // Reschedule auto-visits for this date
      try {
        await DoctorVisit.destroy({ where: { user_id: day.tourPlan.user_id, date: day.date, confirmed: false } });
        await ChemistVisit.destroy({ where: { user_id: day.tourPlan.user_id, date: day.date, confirmed: false } });
        await StockistVisit.destroy({ where: { user_id: day.tourPlan.user_id, date: day.date, confirmed: false } });

        const autoScheduler = require('../utils/autoScheduler');
        if (autoScheduler && autoScheduler.autoScheduleVisits) {
          await autoScheduler.autoScheduleVisits(sequelize, models, day.tourPlan.user_id, day.date, day.date, 'all');
        }
      } catch (schedErr) {
        console.error('Error auto-scheduling visits on direct change:', schedErr);
      }

      return res.json({
        success: true,
        autoApproved: true,
        directChangesUsed: currentDirectCount + 1,
        message: `Beat updated directly! (${currentDirectCount + 1}/3 free monthly changes used)`,
        data: day
      });
    } else {
      // 4th Change Onwards -> Pending Approval Request
      day.change_request_status = 'Pending';
      day.change_request_reason = reason;
      day.change_request_beat_id_1 = beat_id_1 || null;
      day.change_request_beat_id_2 = beat_id_2 || null;
      day.change_request_day_type = day_type || 'Field';
      day.change_request_comments = null;

      await day.save();

      return res.json({
        success: true,
        autoApproved: false,
        directChangesUsed: currentDirectCount,
        message: 'Monthly 3 direct change limit reached. Approval request submitted to ASM/Manager.',
        data: day
      });
    }
  } catch (error) {
    console.error('Request day change error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET pending same-day change requests for juniors
const getPendingChangeRequests = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { TourPlanDay, TourPlan, User, Beat } = models;

    let userWhere = {};
    if (!['Super Admin', 'Admin', 'Opps Team'].includes(req.user.role)) {
      const approverRank = ROLE_HIERARCHY[req.user.role] || 0;
      const juniorRolesList = Object.keys(ROLE_HIERARCHY).filter(role => ROLE_HIERARCHY[role] < approverRank);
      userWhere = { role: juniorRolesList };
    }

    const pendingRequests = await TourPlanDay.findAll({
      where: {
        change_request_status: 'Pending'
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          required: true,
          include: [{
            model: User,
            as: 'user',
            where: userWhere,
            attributes: ['id', 'name', 'role', 'employee_code']
          }]
        },
        { model: Beat, as: 'beat1', attributes: ['id', 'name'] },
        { model: Beat, as: 'beat2', attributes: ['id', 'name'] },
        { model: Beat, as: 'changeRequestBeat1', attributes: ['id', 'name'] },
        { model: Beat, as: 'changeRequestBeat2', attributes: ['id', 'name'] }
      ],
      order: [['date', 'ASC']]
    });

    res.json({
      success: true,
      data: pendingRequests
    });
  } catch (error) {
    console.error('Get pending change requests error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// POST respond to a pending same-day change request
const respondToDayChangeRequest = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  const transaction = await sequelize.transaction();
  let committed = false;

  try {
    const { dayId } = req.params;
    const { action, comments } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either approve or reject'
      });
    }

    const models = req.app.get('models');
    const { TourPlanDay, TourPlan, User, DoctorVisit, ChemistVisit, StockistVisit } = models;

    const day = await TourPlanDay.findByPk(dayId, {
      include: [{
        model: TourPlan,
        as: 'tourPlan',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'role']
        }]
      }],
      transaction
    });

    if (!day || day.change_request_status !== 'Pending') {
      return res.status(404).json({
        success: false,
        message: 'Pending change request not found'
      });
    }

    // Verify role hierarchy: approver must be strictly higher rank than creator (unless Admin / Super Admin / Opps Team)
    if (!['Super Admin', 'Admin', 'Opps Team'].includes(req.user.role)) {
      const creatorRank = ROLE_HIERARCHY[day.tourPlan.user.role] || 0;
      const approverRank = ROLE_HIERARCHY[req.user.role] || 0;

      if (approverRank <= creatorRank) {
        return res.status(403).json({
          success: false,
          message: `Permission denied. Your role (${req.user.role}) is not authorized to approve requests for a ${day.tourPlan.user.role}.`
        });
      }
    }

    if (action === 'approve') {
      // 1. Update the actual tour plan day's beats and day_type
      day.beat_id_1 = day.change_request_beat_id_1;
      day.beat_id_2 = day.change_request_beat_id_2;
      day.day_type = day.change_request_day_type;
      day.change_request_status = 'Approved';
      day.change_request_comments = comments || null;
      await day.save({ transaction });

      // Commit the transaction first so the new day beats are visible to auto-scheduling
      await transaction.commit();
      committed = true;

      // 2. Perform rescheduling of visits for today
      try {
        console.log(`Rescheduling auto-visits for user ${day.tourPlan.user_id} on date ${day.date}...`);

        // Delete all unconfirmed visits for today
        await DoctorVisit.destroy({ where: { user_id: day.tourPlan.user_id, date: day.date, confirmed: false } });
        await ChemistVisit.destroy({ where: { user_id: day.tourPlan.user_id, date: day.date, confirmed: false } });
        await StockistVisit.destroy({ where: { user_id: day.tourPlan.user_id, date: day.date, confirmed: false } });

        // Trigger new auto-scheduling
        const { autoScheduleVisits } = require('../utils/autoScheduler');
        await autoScheduleVisits(sequelize, models, day.tourPlan.user_id, day.date, day.date, 'all');
      } catch (scheduleErr) {
        console.error('Failed to reschedule visits after change request approval:', scheduleErr);
      }
    } else {
      // Reject change request
      day.change_request_status = 'Rejected';
      day.change_request_comments = comments || null;
      await day.save({ transaction });
      await transaction.commit();
      committed = true;
    }

    res.json({
      success: true,
      message: `Change request successfully ${action}d`,
      data: day
    });
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    console.error('Respond to day change error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a tour plan by ID
const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const models = req.app.get('models');
    const { TourPlan, TourPlanDay, DoctorVisit, ChemistVisit, StockistVisit } = models;

    const plan = await TourPlan.findByPk(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan not found'
      });
    }

    // Authorization checks:
    // 1. User can delete their own plan. Admins can delete any plan.
    if (plan.user_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. You can only delete your own tour plans.'
      });
    }

    // Status checks for non-admins:
    // Only Draft or Returned plans can be deleted by standard users.
    if (req.user.role !== 'Admin' && !['Draft', 'Returned'].includes(plan.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete a tour plan that is ${plan.status}. Please contact an administrator.`
      });
    }

    // If the plan was approved, clean up any unconfirmed visits generated from it
    if (plan.status === 'Approved') {
      const days = await TourPlanDay.findAll({
        where: { tour_plan_id: plan.id }
      });
      const dates = days.map(d => d.date);

      if (dates.length > 0) {
        await DoctorVisit.destroy({
          where: {
            user_id: plan.user_id,
            date: { [require('sequelize').Op.in]: dates },
            confirmed: false
          }
        });
        await ChemistVisit.destroy({
          where: {
            user_id: plan.user_id,
            date: { [require('sequelize').Op.in]: dates },
            confirmed: false
          }
        });
        await StockistVisit.destroy({
          where: {
            user_id: plan.user_id,
            date: { [require('sequelize').Op.in]: dates },
            confirmed: false
          }
        });
      }
    }

    await plan.destroy();

    res.json({
      success: true,
      message: 'Tour plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete tour plan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// POST perform joint work handshake verification with 200m geo-fence check
const performJointWorkHandshake = async (req, res) => {
  try {
    const { dayId } = req.params;
    const { latitude, longitude, partner_latitude, partner_longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Current GPS location (latitude and longitude) is required'
      });
    }

    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { TourPlanDay, TourPlan, User } = models;

    const day = await TourPlanDay.findByPk(dayId, {
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'role'] }]
        },
        { model: User, as: 'jointWorkWith', attributes: ['id', 'name', 'role'] }
      ]
    });

    if (!day) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan day not found'
      });
    }

    const isCreator = day.tourPlan.user_id === req.user.id;
    let partnerId = null;
    let partnerName = 'Colleague';

    if (isCreator) {
      partnerId = day.joint_work_with_user_id || (Array.isArray(day.joint_work_user_ids) ? day.joint_work_user_ids[0] : null);
      partnerName = day.jointWorkWith ? day.jointWorkWith.name : 'Colleague';
    } else {
      partnerId = day.tourPlan.user_id;
      partnerName = day.tourPlan.user ? day.tourPlan.user.name : 'MR';
    }

    let partnerLat = partner_latitude ? parseFloat(partner_latitude) : null;
    let partnerLng = partner_longitude ? parseFloat(partner_longitude) : null;

    if ((!partnerLat || !partnerLng) && partnerId) {
      try {
        const [latestLocation] = await sequelize.query(`
          SELECT 
            (payload->>'latitude')::numeric as lat, 
            (payload->>'longitude')::numeric as lng 
          FROM offline_bg_trackings 
          WHERE user_id = :partnerId 
            AND payload->>'latitude' IS NOT NULL 
            AND payload->>'longitude' IS NOT NULL 
          ORDER BY created_at_utc DESC 
          LIMIT 1
        `, {
          replacements: { partnerId },
          type: sequelize.QueryTypes.SELECT
        });

        if (latestLocation && latestLocation.lat && latestLocation.lng) {
          partnerLat = parseFloat(latestLocation.lat);
          partnerLng = parseFloat(latestLocation.lng);
        }
      } catch (locErr) {
        console.error('Error fetching partner location from tracking:', locErr);
      }
    }

    if (!partnerLat || !partnerLng) {
      partnerLat = parseFloat(latitude);
      partnerLng = parseFloat(longitude);
    }

    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);

    const getDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3;
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distanceMeters = getDistance(userLat, userLng, partnerLat, partnerLng);
    const roundedDistance = Math.round(distanceMeters);

    day.handshake_time = new Date();
    day.handshake_user_lat = userLat;
    day.handshake_user_lng = userLng;
    day.handshake_partner_lat = partnerLat;
    day.handshake_partner_lng = partnerLng;
    day.handshake_distance_meters = roundedDistance;
    day.handshake_verified_by_user_id = req.user.id;

    if (distanceMeters <= 200) {
      day.handshake_status = 'Completed';
      await day.save();

      return res.json({
        success: true,
        verified: true,
        distanceMeters: roundedDistance,
        message: `Handshake verified! You are working together with ${partnerName} (Distance: ${roundedDistance}m).`,
        data: day
      });
    } else {
      day.handshake_status = 'Failed';
      await day.save();

      return res.status(400).json({
        success: false,
        verified: false,
        distanceMeters: roundedDistance,
        message: `Handshake refused! You are currently ${roundedDistance} meters away from ${partnerName}. You must be within 200 meters of each other to verify Joint Work.`,
        data: day
      });
    }
  } catch (error) {
    console.error('Perform joint work handshake error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET all joint work handshake data for Admin Panel
const getAdminHandshakeData = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { TourPlan, TourPlanDay, User, Beat } = models;
    const { Op } = require('sequelize');

    const handshakes = await TourPlanDay.findAll({
      where: {
        [Op.or]: [
          { day_type: 'Joint work' },
          { joint_work_with_user_id: { [Op.ne]: null } },
          { handshake_status: { [Op.ne]: 'None' } }
        ]
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          required: true,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'role', 'employee_code']
            }
          ]
        },
        { model: User, as: 'jointWorkWith', attributes: ['id', 'name', 'role', 'employee_code'] },
        { model: Beat, as: 'beat1', attributes: ['id', 'name'] },
        { model: Beat, as: 'beat2', attributes: ['id', 'name'] }
      ],
      order: [['date', 'DESC']]
    });

    const enrichedHandshakes = await enrichTourPlanDaysWithJointUsers(handshakes, User);

    res.json({
      success: true,
      data: enrichedHandshakes
    });
  } catch (error) {
    console.error('Get admin handshake data error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getMyPlans,
  getPlanById,
  saveDraft,
  submitPlan,
  approvePlan,
  returnPlan,
  getPendingApprovals,
  getAllPlansAdmin,
  getUsersAvailability,
  getIncomingCollaborations,
  getAcceptedCollaborations,
  sendCollaborationRequest,
  respondToCollaboration,
  updateDayCollaboration,
  performJointWorkHandshake,
  getAdminHandshakeData,
  requestDayChange,
  getPendingChangeRequests,
  respondToDayChangeRequest,
  deletePlan
};
