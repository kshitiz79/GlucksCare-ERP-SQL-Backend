const ROLE_HIERARCHY = {
  'User': 1,
  'Manager': 2,
  'Area Manager': 3,
  'Zonal Manager': 4,
  'State Head': 5,
  'National Head': 6,
  'Admin': 7,
  'Super Admin': 8
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

    res.json({
      success: true,
      data: plans
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

    res.json({
      success: true,
      data: plan
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
      const dayRecords = days.map(d => ({
        tour_plan_id: plan.id,
        date: d.date,
        day_type: d.day_type || 'Field',
        beat_id_1: d.beat_id_1 || null,
        beat_id_2: d.beat_id_2 || null,
        joint_work_with_user_id: d.day_type === 'Joint work' ? (d.joint_work_with_user_id || null) : null,
        collaboration_status: d.day_type === 'Joint work' ? (d.collaboration_status || 'None') : 'None',
        notes: d.notes || null
      }));

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

    res.json({
      success: true,
      message: 'Draft saved successfully',
      data: updatedPlan
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

    res.json({
      success: true,
      data: plans
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

    res.json({
      success: true,
      data: plans
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
    const { TourPlan, TourPlanDay, User } = models;

    const incoming = await TourPlanDay.findAll({
      where: {
        joint_work_with_user_id: req.user.id,
        collaboration_status: 'Pending'
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          where: { status: 'Approved' },
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

    res.json({
      success: true,
      data: incoming
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
    const { TourPlan, TourPlanDay, User } = models;

    const accepted = await TourPlanDay.findAll({
      where: {
        joint_work_with_user_id: req.user.id,
        collaboration_status: 'Accepted'
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          where: { status: 'Approved' },
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

    res.json({
      success: true,
      data: accepted
    });
  } catch (error) {
    console.error('Get accepted collaborations error:', error);
    res.status(500).json({
      success: false,
      message: error.message
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
    const { TourPlanDay, TourPlan } = models;

    const day = await TourPlanDay.findOne({
      where: {
        id: dayId,
        joint_work_with_user_id: req.user.id,
        collaboration_status: 'Pending'
      },
      include: [
        {
          model: TourPlan,
          as: 'tourPlan',
          where: { status: 'Approved' }
        }
      ]
    });

    if (!day) {
      return res.status(404).json({
        success: false,
        message: 'Pending collaboration request not found for this day'
      });
    }

    day.collaboration_status = action === 'accept' ? 'Accepted' : 'Rejected';
    await day.save();

    res.json({
      success: true,
      message: `Collaboration request successfully ${action}ed`,
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
    const { TourPlanDay, TourPlan, Beat } = models;

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

    // Validate that it is for the SAME day (today) only
    const today = new Date().toISOString().split('T')[0];
    if (day.date !== today) {
      return res.status(400).json({
        success: false,
        message: 'Change requests can only be made for today\'s date'
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

    // Update change request fields
    day.change_request_status = 'Pending';
    day.change_request_reason = reason;
    day.change_request_beat_id_1 = beat_id_1 || null;
    day.change_request_beat_id_2 = beat_id_2 || null;
    day.change_request_day_type = day_type || 'Field';
    day.change_request_comments = null;

    await day.save();

    res.json({
      success: true,
      message: 'Change request submitted successfully',
      data: day
    });
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

    // Get list of roles junior to the current user
    const approverRank = ROLE_HIERARCHY[req.user.role] || 0;
    const juniorRolesList = Object.keys(ROLE_HIERARCHY).filter(role => ROLE_HIERARCHY[role] < approverRank);

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
            where: { role: juniorRolesList },
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

    // Verify role hierarchy: approver must be strictly higher rank than creator
    const creatorRank = ROLE_HIERARCHY[day.tourPlan.user.role] || 0;
    const approverRank = ROLE_HIERARCHY[req.user.role] || 0;

    if (approverRank <= creatorRank) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Your role (${req.user.role}) is not authorized to approve requests for a ${day.tourPlan.user.role}.`
      });
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
  respondToCollaboration,
  requestDayChange,
  getPendingChangeRequests,
  respondToDayChangeRequest
};
