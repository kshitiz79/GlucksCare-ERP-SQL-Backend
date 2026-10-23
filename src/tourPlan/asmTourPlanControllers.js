const { Op } = require('sequelize');

// All valid roles as specified:
// isIn: [['Super Admin', 'Admin', 'Opps Team', 'National Head', 'State Head', 'Zonal Manager', 'Area Manager', 'Manager', 'User', 'Accounts', 'Logistics']]
const ALL_VALID_ROLES = [
  'Super Admin',
  'Admin',
  'Opps Team',
  'National Head',
  'State Head',
  'Zonal Manager',
  'Area Manager',
  'Manager',
  'User',
  'Accounts',
  'Logistics'
];

const MANAGER_LEVEL_ROLES = [
  'Super Admin',
  'Admin',
  'Opps Team',
  'National Head',
  'State Head',
  'Zonal Manager',
  'Area Manager',
  'Manager'
];

const RSM_ROLES = [
  'Zonal Manager',
  'State Head',
  'National Head',
  'Manager'
];

const { ensureTourPlanSchema } = require('./ensureTourPlanSchema');

const getModels = (req) => {
  return req?.db || (req?.app && typeof req.app.get === 'function' && req.app.get('models')) || require('../config/database');
};

const getSequelize = (req) => {
  return req?.tenantSequelize || (req?.app && typeof req.app.get === 'function' && req.app.get('sequelize')) || require('../config/database').sequelize;
};

/**
 * Helper to get all assigned Head Office IDs for an ASM/Manager.
 * Checks:
 * 1. user_head_offices table (multiple HQs assignment)
 * 2. users.head_office_id (primary HQ)
 * 3. user.headOffices association
 * 4. State Head active HQs in state
 * 5. Admin / Super Admin (fallback to all active HQs)
 */
const getAssignedHeadOfficeIds = async (user, models) => {
  const m = models || require('../config/database');
  const UserHeadOffice = m.UserHeadOffice || (m.models && m.models.UserHeadOffice);
  const HeadOffice = m.HeadOffice || (m.models && m.models.HeadOffice);
  const officeIds = new Set();

  if (!user) return [];

  // 1. Direct head_office_id on user
  if (user.head_office_id) {
    officeIds.add(user.head_office_id);
  }

  // 2. Junction table user_head_offices
  if (UserHeadOffice) {
    try {
      const uhoList = await UserHeadOffice.findAll({
        where: { user_id: user.id },
        attributes: ['head_office_id'],
        raw: true
      });
      uhoList.forEach(uho => {
        if (uho.head_office_id) officeIds.add(uho.head_office_id);
      });
    } catch (e) {
      console.warn('[getAssignedHeadOfficeIds] user_head_offices query warning:', e.message);
    }
  }

  // 3. User association headOffices
  if (user.headOffices && Array.isArray(user.headOffices)) {
    user.headOffices.forEach(ho => {
      if (ho.id) officeIds.add(ho.id);
    });
  }

  // 4. State Head fallback (all active HQs in state)
  if (user.role === 'State Head' && user.state_id && HeadOffice) {
    try {
      const stateOffices = await HeadOffice.findAll({
        where: { stateId: user.state_id, is_active: true },
        attributes: ['id'],
        raw: true
      });
      stateOffices.forEach(ho => {
        if (ho.id) officeIds.add(ho.id);
      });
    } catch (e) {
      console.warn('[getAssignedHeadOfficeIds] State Head query warning:', e.message);
    }
  }

  // 5. Admin / Super Admin fallback (all active HQs if none assigned directly)
  if (officeIds.size === 0 && ['Super Admin', 'Admin', 'Opps Team', 'National Head'].includes(user.role) && HeadOffice) {
    try {
      const allOffices = await HeadOffice.findAll({
        where: { is_active: true },
        attributes: ['id'],
        raw: true
      });
      allOffices.forEach(ho => {
        if (ho.id) officeIds.add(ho.id);
      });
    } catch (e) {
      console.warn('[getAssignedHeadOfficeIds] Admin all offices query warning:', e.message);
    }
  }

  // 6. Resolve duplicate Head Offices by normalized name (e.g. 'Darbhanga' vs 'DARBHANGA', 'Katihar', etc.)
  if (officeIds.size > 0 && HeadOffice) {
    try {
      const knownOffices = await HeadOffice.findAll({
        where: { id: { [Op.in]: Array.from(officeIds) } },
        attributes: ['id', 'name'],
        raw: true
      });
      const names = knownOffices.map(o => (o.name || '').trim().toLowerCase()).filter(Boolean);
      if (names.length > 0) {
        const seq = m.sequelize || (m.models && m.models.HeadOffice && m.models.HeadOffice.sequelize) || require('../config/database').sequelize;
        if (seq) {
          const matchingSisterHqs = await HeadOffice.findAll({
            where: seq.where(
              seq.fn('LOWER', seq.fn('TRIM', seq.col('name'))),
              { [Op.in]: names }
            ),
            attributes: ['id'],
            raw: true
          });
          matchingSisterHqs.forEach(ho => {
            if (ho.id) officeIds.add(ho.id);
          });
        }
      }
    } catch (e) {
      console.warn('[getAssignedHeadOfficeIds] duplicate name resolution warning:', e.message);
    }
  }

  return Array.from(officeIds).filter(Boolean);
};

/**
 * Normalizes day types across standard and custom naming
 */
const normalizeDayType = (type) => {
  if (!type) return 'Field';
  const clean = String(type).trim();
  const lower = clean.toLowerCase();
  if (lower === 'joint work' || lower === 'jointwork' || lower === 'co-work' || lower === 'cowork') return 'Joint Work';
  if (lower === 'office work' || lower === 'officework' || lower === 'office') return 'Office Work';
  if (lower === 'field') return 'Field';
  if (lower === 'meeting') return 'Meeting';
  if (lower === 'transit') return 'Transit';
  if (lower === 'leave') return 'Leave';
  if (lower === 'holiday') return 'Holiday';
  if (lower === 'weekly off' || lower === 'weeklyoff' || lower === 'sunday') return 'Weekly off';
  return clean;
};

/**
 * Normalizes input date to YYYY-MM-DD
 */
const normalizeDateStr = (inputDate) => {
  if (!inputDate) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  if (typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate.trim())) {
    return inputDate.trim();
  }
  const d = new Date(inputDate);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

/**
 * Helper to fetch complete HQ details with active managers/users and their day beats + assigned areas
 */
const getHqDetailsWithManagersAndDayBeats = async (headOfficeId, dateStr, models) => {
  const { HeadOffice, State, User, UserHeadOffice, Beat, Area, TourPlan, TourPlanDay } = models;

  // 1. Fetch HeadOffice with State
  const hq = await HeadOffice.findByPk(headOfficeId, {
    include: State ? [{ model: State, attributes: ['id', 'name'] }] : []
  });

  if (!hq) return null;

  // 2. Find all active managers/users working under this HQ
  // Users whose head_office_id = hq.id OR who are mapped in user_head_offices to this HQ
  const userIdsSet = new Set();

  const directUsers = await User.findAll({
    where: {
      head_office_id: headOfficeId,
      is_active: true,
      role: { [Op.in]: ALL_VALID_ROLES }
    },
    attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'gender', 'role', 'head_office_id', 'state_id', 'is_active']
  });
  directUsers.forEach(u => userIdsSet.add(u.id));

  if (UserHeadOffice) {
    const junctionUsers = await UserHeadOffice.findAll({
      where: { head_office_id: headOfficeId },
      attributes: ['user_id'],
      raw: true
    });
    junctionUsers.forEach(j => {
      if (j.user_id) userIdsSet.add(j.user_id);
    });
  }

  const allUserIds = Array.from(userIdsSet).filter(Boolean);

  let activeManagers = [];
  if (allUserIds.length > 0) {
    activeManagers = await User.findAll({
      where: {
        id: { [Op.in]: allUserIds },
        is_active: true,
        role: { [Op.in]: ALL_VALID_ROLES }
      },
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'gender', 'role', 'head_office_id', 'state_id', 'is_active'],
      order: [['name', 'ASC']]
    });
  }

  // 3. For every active manager/user under this HQ, fetch:
  // - Their beat(s) for that particular day (from TourPlanDay)
  // - All beats owned by them
  // - Mapped areas under this HQ
  const managerCards = [];
  const hqDayAreasSet = new Map(); // area_id -> area object

  for (const mgr of activeManagers) {
    const plainMgr = mgr.toJSON ? mgr.toJSON() : mgr;

    // A. Day beat(s) assigned for dateStr
    let dayBeats = [];
    let tourPlanDayInfo = null;

    if (TourPlanDay && TourPlan) {
      const planDay = await TourPlanDay.findOne({
        where: { date: dateStr },
        include: [
          {
            model: TourPlan,
            as: 'tourPlan',
            where: { user_id: mgr.id },
            attributes: ['id', 'status', 'month', 'year']
          },
          ...(Beat ? [
            {
              model: Beat,
              as: 'beat1',
              attributes: ['id', 'name', 'color', 'is_active'],
              include: Area ? [{ model: Area, as: 'areas', attributes: ['id', 'name', 'pincode', 'post_office', 'head_office_id', 'latitude', 'longitude', 'radius'], through: { attributes: [] } }] : []
            },
            {
              model: Beat,
              as: 'beat2',
              attributes: ['id', 'name', 'color', 'is_active'],
              include: Area ? [{ model: Area, as: 'areas', attributes: ['id', 'name', 'pincode', 'post_office', 'head_office_id', 'latitude', 'longitude', 'radius'], through: { attributes: [] } }] : []
            }
          ] : [])
        ]
      });

      if (planDay) {
        tourPlanDayInfo = {
          id: planDay.id,
          date: planDay.date,
          day_type: planDay.day_type,
          notes: planDay.notes,
          status: planDay.tourPlan ? planDay.tourPlan.status : 'Draft',
          collaboration_status: planDay.collaboration_status,
          handshake_status: planDay.handshake_status
        };

        if (planDay.beat1) dayBeats.push(planDay.beat1);
        if (planDay.beat2) dayBeats.push(planDay.beat2);
      }
    }

    // B. All beats of this manager/user
    let allBeats = [];
    if (Beat) {
      allBeats = await Beat.findAll({
        where: { user_id: mgr.id, is_active: true },
        attributes: ['id', 'name', 'color', 'is_active'],
        include: Area ? [{
          model: Area,
          as: 'areas',
          attributes: ['id', 'name', 'pincode', 'post_office', 'head_office_id', 'latitude', 'longitude', 'radius'],
          through: { attributes: [] }
        }] : []
      });
    }

    // C. Map areas for that particular day
    const dayAreasMap = new Map();
    dayBeats.forEach(b => {
      const bAreas = b.areas || [];
      bAreas.forEach(a => {
        const plainArea = a.toJSON ? a.toJSON() : a;
        if (!dayAreasMap.has(plainArea.id)) {
          dayAreasMap.set(plainArea.id, plainArea);
        }
        if (!hqDayAreasSet.has(plainArea.id)) {
          hqDayAreasSet.set(plainArea.id, plainArea);
        }
      });
    });

    // D. Map all assigned areas under this HQ
    const assignedAreasMap = new Map();
    allBeats.forEach(b => {
      const bAreas = b.areas || [];
      bAreas.forEach(a => {
        const plainArea = a.toJSON ? a.toJSON() : a;
        // Include areas belonging to this HQ
        if (plainArea.head_office_id === headOfficeId || !plainArea.head_office_id) {
          if (!assignedAreasMap.has(plainArea.id)) {
            assignedAreasMap.set(plainArea.id, plainArea);
          }
        }
      });
    });

    // Also direct areas in Area table for this HQ if assigned directly or beats map them
    managerCards.push({
      ...plainMgr,
      tour_plan_day: tourPlanDayInfo,
      day_beats: dayBeats.map(b => (b.toJSON ? b.toJSON() : b)),
      day_areas: Array.from(dayAreasMap.values()),
      all_beats: allBeats.map(b => (b.toJSON ? b.toJSON() : b)),
      assigned_areas: Array.from(assignedAreasMap.values())
    });
  }

  // 4. Fetch all areas belonging to this HeadOffice
  let allHqAreas = [];
  if (Area) {
    allHqAreas = await Area.findAll({
      where: { head_office_id: headOfficeId, is_active: true },
      attributes: ['id', 'name', 'pincode', 'post_office', 'latitude', 'longitude', 'radius']
    });
  }

  return {
    id: hq.id,
    name: hq.name,
    pincode: hq.pincode,
    latitude: hq.latitude,
    longitude: hq.longitude,
    is_active: hq.is_active,
    state: hq.State ? { id: hq.State.id, name: hq.State.name } : null,
    location: {
      latitude: hq.latitude,
      longitude: hq.longitude,
      pincode: hq.pincode,
      state: hq.State ? hq.State.name : null
    },
    total_active_managers: managerCards.length,
    total_manager_count: managerCards.length,
    total_active_msrs: managerCards.length, // Aliased for full compatibility
    total_msr_count: managerCards.length,   // Aliased for full compatibility
    managers: managerCards,
    msrs: managerCards, // Aliased for full compatibility
    day_areas_covered: Array.from(hqDayAreasSet.values()),
    all_areas: allHqAreas
  };
};

/**
 * 1. HQ-wise API based on ASM Assigned HQs (Supports multiple Head Offices)
 * Returns each HQ's details, total number of active managers/users working under it,
 * complete details of every manager/user, all beats of that particular day assigned to each,
 * and clearly maps every manager and their assigned areas under the correct HQ.
 *
 * GET /api/tour-plans/asm/assigned-hqs
 * GET /api/tour-plans/asm/hqs
 */
const getAsmHeadOfficesOverview = async (req, res) => {
  try {
    const models = getModels(req);
    if (!models || !models.User || !models.HeadOffice) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    const { User } = models;

    // Target ASM/Manager ID (support viewing on behalf by Admin/State Head)
    let targetUserId = req.user.id;
    const requestedUserId = req.body?.user_id || req.body?.asm_id || req.body?.manager_id || req.query?.user_id || req.query?.asm_id || req.query?.manager_id;
    if (requestedUserId && MANAGER_LEVEL_ROLES.includes(req.user.role)) {
      targetUserId = requestedUserId;
    }

    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'ASM / Manager user not found'
      });
    }

    // Target date (POST body or GET query, defaults to current date YYYY-MM-DD)
    const rawDate = req.body?.date || req.query?.date;
    const dateStr = normalizeDateStr(rawDate);

    // Get all assigned Head Offices for this ASM
    const assignedHqIds = await getAssignedHeadOfficeIds(targetUser, models);

    if (!assignedHqIds || assignedHqIds.length === 0) {
      return res.json({
        success: true,
        message: 'No Head Offices currently assigned to this ASM / Manager',
        date: dateStr,
        asm: {
          id: targetUser.id,
          name: targetUser.name,
          role: targetUser.role,
          employee_code: targetUser.employee_code
        },
        total_assigned_hqs: 0,
        data: []
      });
    }

    // Optional filter by specific head_office_id
    const filterHqId = req.body?.head_office_id || req.body?.headOfficeId || req.query?.head_office_id || req.query?.headOfficeId;
    let targetHqIds = assignedHqIds;
    if (filterHqId) {
      if (!assignedHqIds.includes(filterHqId) && !['Super Admin', 'Admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'The requested Head Office is not assigned to this ASM / Manager'
        });
      }
      targetHqIds = [filterHqId];
    }

    // Build HQ details with managers and beats for the day
    const hqResults = [];
    for (const hqId of targetHqIds) {
      const hqData = await getHqDetailsWithManagersAndDayBeats(hqId, dateStr, models);
      if (hqData) {
        hqResults.push(hqData);
      }
    }

    res.json({
      success: true,
      date: dateStr,
      asm: {
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role,
        employee_code: targetUser.employee_code
      },
      total_assigned_hqs: hqResults.length,
      data: hqResults
    });
  } catch (error) {
    console.error('getAsmHeadOfficesOverview error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * ASM Date Users & Beats API:
 * Dedicated POST endpoint where ASM sends { date: 'YYYY-MM-DD' } (or GET query)
 * Returns all users working under common Head Office(s) assigned to this ASM,
 * along with their assigned beats and mapped areas for that specific date.
 *
 * POST /api/tour-plans/asm/users-by-date
 * POST /api/tour-plans/asm/date-areas
 * POST /api/tour-plans/asm/date-users
 * GET  /api/tour-plans/asm/users-by-date
 */
const getAsmDateUsersOverview = async (req, res) => {
  try {
    const models = getModels(req);
    if (!models || !models.User || !models.HeadOffice) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    const { User, HeadOffice, State, UserHeadOffice, Beat, Area, TourPlan, TourPlanDay } = models;

    // Target ASM/Manager ID (support viewing on behalf by Admin/State Head/RSM)
    let targetUserId = req.user.id;
    const requestedUserId = req.body?.user_id || req.body?.asm_id || req.body?.manager_id || req.query?.user_id || req.query?.asm_id || req.query?.manager_id;
    if (requestedUserId && MANAGER_LEVEL_ROLES.includes(req.user.role)) {
      targetUserId = requestedUserId;
    }

    const targetUser = await User.findByPk(targetUserId, {
      include: HeadOffice ? [{ model: HeadOffice, attributes: ['id', 'name', 'pincode'] }] : []
    });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'ASM / Manager user not found'
      });
    }

    // Target date from POST body or query param
    const rawDate = req.body?.date || req.query?.date;
    const dateStr = normalizeDateStr(rawDate);

    // Get all assigned Head Offices for this ASM
    const assignedHqIds = await getAssignedHeadOfficeIds(targetUser, models);

    if (!assignedHqIds || assignedHqIds.length === 0) {
      return res.json({
        success: true,
        message: 'No Head Offices currently assigned to this ASM / Manager',
        date: dateStr,
        asm: {
          id: targetUser.id,
          name: targetUser.name,
          role: targetUser.role,
          employee_code: targetUser.employee_code
        },
        total_assigned_hqs: 0,
        total_users: 0,
        users: [],
        head_offices: []
      });
    }

    // Optional filter by specific head_office_id
    const filterHqId = req.body?.head_office_id || req.body?.headOfficeId || req.query?.head_office_id || req.query?.headOfficeId;
    let targetHqIds = assignedHqIds;
    if (filterHqId) {
      if (!assignedHqIds.includes(filterHqId) && !['Super Admin', 'Admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'The requested Head Office is not assigned to this ASM / Manager'
        });
      }
      targetHqIds = [filterHqId];
    }

    // Optional role filter (e.g. only "User" / "MSR" or all roles)
    const filterRole = req.body?.role || req.query?.role;

    // Fetch HQs
    const headOffices = await HeadOffice.findAll({
      where: { id: { [Op.in]: targetHqIds } },
      include: State ? [{ model: State, attributes: ['id', 'name'] }] : []
    });
    const hqMap = new Map();
    headOffices.forEach(h => {
      const plainH = h.toJSON ? h.toJSON() : h;
      hqMap.set(plainH.id, plainH);
    });

    // 1. Gather all users belonging to these common Head Offices
    const userHqMapping = new Map(); // userId -> Set of head_office_ids
    const allUserIdsSet = new Set();

    // Direct HQ users
    const directUsers = await User.findAll({
      where: {
        head_office_id: { [Op.in]: targetHqIds },
        is_active: true,
        ...(filterRole ? { role: filterRole } : {})
      },
      attributes: ['id', 'head_office_id'],
      raw: true
    });
    directUsers.forEach(u => {
      allUserIdsSet.add(u.id);
      if (!userHqMapping.has(u.id)) userHqMapping.set(u.id, new Set());
      userHqMapping.get(u.id).add(u.head_office_id);
    });

    // Junction table user_head_offices
    if (UserHeadOffice) {
      try {
        const junctionRecords = await UserHeadOffice.findAll({
          where: { head_office_id: { [Op.in]: targetHqIds } },
          attributes: ['user_id', 'head_office_id'],
          raw: true
        });
        junctionRecords.forEach(j => {
          if (j.user_id) {
            allUserIdsSet.add(j.user_id);
            if (!userHqMapping.has(j.user_id)) userHqMapping.set(j.user_id, new Set());
            userHqMapping.get(j.user_id).add(j.head_office_id);
          }
        });
      } catch (e) {
        console.warn('[getAsmDateUsersOverview] junction query warning:', e.message);
      }
    }

    // Direct subordinates mapped in user_managers table
    const UserManager = models.UserManager || (models.models && models.models.UserManager);
    if (UserManager) {
      try {
        const managedRecords = await UserManager.findAll({
          where: { manager_id: targetUser.id },
          attributes: ['user_id'],
          raw: true
        });
        managedRecords.forEach(m => {
          if (m.user_id) allUserIdsSet.add(m.user_id);
        });
      } catch (e) {
        console.warn('[getAsmDateUsersOverview] UserManager query warning:', e.message);
      }
    }

    const allUserIds = Array.from(allUserIdsSet).filter(Boolean);

    // Fetch complete user details
    let teamUsers = [];
    if (allUserIds.length > 0) {
      teamUsers = await User.findAll({
        where: {
          id: { [Op.in]: allUserIds },
          is_active: true,
          ...(filterRole ? { role: filterRole } : {})
        },
        attributes: [
          'id', 'name', 'employee_code', 'email', 'mobile_number',
          'gender', 'role', 'head_office_id', 'state_id', 'is_active'
        ],
        include: [
          ...(HeadOffice ? [{ model: HeadOffice, attributes: ['id', 'name', 'pincode'] }] : []),
          ...(State ? [{ model: State, as: 'State', attributes: ['id', 'name'] }] : [])
        ],
        order: [['name', 'ASC']]
      });
    }

    // 2. For each user, fetch their plan for dateStr and their beat(s) + areas
    const userCards = [];
    const hqUserCardsMap = new Map(); // hqId -> array of userCards
    targetHqIds.forEach(id => hqUserCardsMap.set(id, []));

    for (const u of teamUsers) {
      const plainUser = u.toJSON ? u.toJSON() : u;

      // Find primary or mapped HQ for this user
      let primaryHq = null;
      if (plainUser.head_office_id && hqMap.has(plainUser.head_office_id)) {
        primaryHq = hqMap.get(plainUser.head_office_id);
      } else if (plainUser.HeadOffice) {
        primaryHq = plainUser.HeadOffice;
      } else {
        const mappedHqs = userHqMapping.get(plainUser.id);
        if (mappedHqs && mappedHqs.size > 0) {
          const firstHqId = Array.from(mappedHqs)[0];
          primaryHq = hqMap.get(firstHqId);
        }
      }
      if (!primaryHq && targetHqIds.length > 0) {
        primaryHq = hqMap.get(targetHqIds[0]);
      }

      // Day beat(s) assigned for dateStr
      let dayBeats = [];
      let tourPlanDayInfo = null;

      if (TourPlanDay && TourPlan) {
        try {
          const planDay = await TourPlanDay.findOne({
            where: { date: dateStr },
            include: [
              {
                model: TourPlan,
                as: 'tourPlan',
                where: { user_id: plainUser.id },
                attributes: ['id', 'status', 'month', 'year', 'plan_level']
              },
              ...(Beat ? [
                {
                  model: Beat,
                  as: 'beat1',
                  attributes: ['id', 'name', 'color', 'is_active'],
                  include: Area ? [{
                    model: Area,
                    as: 'areas',
                    attributes: ['id', 'name', 'pincode', 'post_office', 'head_office_id', 'latitude', 'longitude', 'radius'],
                    through: { attributes: [] }
                  }] : []
                },
                {
                  model: Beat,
                  as: 'beat2',
                  attributes: ['id', 'name', 'color', 'is_active'],
                  include: Area ? [{
                    model: Area,
                    as: 'areas',
                    attributes: ['id', 'name', 'pincode', 'post_office', 'head_office_id', 'latitude', 'longitude', 'radius'],
                    through: { attributes: [] }
                  }] : []
                }
              ] : [])
            ]
          });

          if (planDay) {
            tourPlanDayInfo = {
              id: planDay.id,
              date: planDay.date,
              day_type: planDay.day_type,
              notes: planDay.notes,
              status: planDay.tourPlan ? planDay.tourPlan.status : 'Draft',
              collaboration_status: planDay.collaboration_status,
              handshake_status: planDay.handshake_status
            };

            if (planDay.beat1) dayBeats.push(planDay.beat1);
            if (planDay.beat2) dayBeats.push(planDay.beat2);
          }
        } catch (e) {
          console.warn(`[getAsmDateUsersOverview] planDay query warning for user ${plainUser.id}:`, e.message);
        }
      }

      // Extract day assigned areas from day beats
      const dayAreasMap = new Map();
      dayBeats.forEach(b => {
        const bAreas = b.areas || [];
        bAreas.forEach(a => {
          const plainArea = a.toJSON ? a.toJSON() : a;
          if (!dayAreasMap.has(plainArea.id)) {
            dayAreasMap.set(plainArea.id, plainArea);
          }
        });
      });
      const dayAssignedAreas = Array.from(dayAreasMap.values());

      // Format only the beat(s) assigned to that particular day
      const formattedDayBeats = dayBeats.map(b => {
        const bPlain = b.toJSON ? b.toJSON() : b;
        return {
          id: bPlain.id,
          name: bPlain.name,
          color: bPlain.color,
          is_active: bPlain.is_active,
          areas: (bPlain.areas || []).map(a => {
            const aPlain = a.toJSON ? a.toJSON() : a;
            return {
              id: aPlain.id,
              name: aPlain.name,
              pincode: aPlain.pincode,
              post_office: aPlain.post_office,
              head_office_id: aPlain.head_office_id,
              latitude: aPlain.latitude,
              longitude: aPlain.longitude,
              radius: aPlain.radius
            };
          })
        };
      });

      const primaryDayBeat = formattedDayBeats[0] || null;

      const userCard = {
        id: plainUser.id,
        user_id: plainUser.id,
        msr_id: plainUser.id,
        name: plainUser.name,
        user_name: plainUser.name,
        msr_name: plainUser.name,
        employee_code: plainUser.employee_code,
        msr_code: plainUser.employee_code,
        email: plainUser.email,
        msr_email: plainUser.email,
        mobile_number: plainUser.mobile_number,
        phone: plainUser.mobile_number,
        gender: plainUser.gender,
        role: plainUser.role,
        is_self: plainUser.id === targetUser.id,
        head_office: {
          id: primaryHq ? primaryHq.id : plainUser.head_office_id,
          name: primaryHq ? primaryHq.name : 'Common Head Office',
          pincode: primaryHq ? primaryHq.pincode : null,
          state: primaryHq?.State?.name || null
        },
        head_office_id: primaryHq ? primaryHq.id : plainUser.head_office_id,
        head_office_name: primaryHq ? primaryHq.name : 'Common Head Office',
        date: dateStr,
        has_day_plan: Boolean(tourPlanDayInfo),
        day_type: tourPlanDayInfo ? tourPlanDayInfo.day_type : 'Not Planned',
        notes: tourPlanDayInfo?.notes || '',
        tour_plan_status: tourPlanDayInfo?.status || 'No Plan',
        collaboration_status: tourPlanDayInfo?.collaboration_status || null,
        handshake_status: tourPlanDayInfo?.handshake_status || null,
        tour_plan_day: tourPlanDayInfo,

        // ONLY beats assigned to that particular day of this MSR
        beat: primaryDayBeat,
        beat_name: primaryDayBeat?.name || null,
        beat_id: primaryDayBeat?.id || null,
        day_beats: formattedDayBeats,
        beats: formattedDayBeats,
        total_day_beats: formattedDayBeats.length,
        total_beats: formattedDayBeats.length,

        // ONLY areas belonging to that particular day's assigned beat(s)
        day_assigned_areas: dayAssignedAreas,
        assigned_areas: dayAssignedAreas,
        areas: dayAssignedAreas,
        day_assigned_area_names: dayAssignedAreas.map(a => a.name),
        assigned_area_names: dayAssignedAreas.map(a => a.name),
        day_assigned_pincodes: dayAssignedAreas.map(a => a.pincode).filter(Boolean),
        total_day_areas: dayAssignedAreas.length,
        total_areas: dayAssignedAreas.length
      };

      userCards.push(userCard);

      // Add to HQ grouping
      const userHqs = userHqMapping.get(plainUser.id) || (plainUser.head_office_id ? new Set([plainUser.head_office_id]) : new Set());
      let addedToHq = false;
      userHqs.forEach(hqId => {
        if (hqUserCardsMap.has(hqId)) {
          hqUserCardsMap.get(hqId).push(userCard);
          addedToHq = true;
        }
      });
      if (!addedToHq && targetHqIds.length > 0) {
        const firstHq = targetHqIds[0];
        if (hqUserCardsMap.has(firstHq)) {
          hqUserCardsMap.get(firstHq).push(userCard);
        }
      }
    }

    // 3. Build Head Office Summaries
    const hqSummaries = [];
    for (const hqId of targetHqIds) {
      const hq = hqMap.get(hqId);
      if (!hq) continue;

      const hqUsers = hqUserCardsMap.get(hqId) || [];

      // Collect all areas covered under this HQ on dateStr
      const hqDayAreasMap = new Map();
      hqUsers.forEach(u => {
        (u.day_assigned_areas || []).forEach(a => {
          if (!hqDayAreasMap.has(a.id)) {
            hqDayAreasMap.set(a.id, a);
          }
        });
      });

      // All areas defined under this Head Office in the Area table
      let allHqAreas = [];
      if (Area) {
        try {
          allHqAreas = await Area.findAll({
            where: { head_office_id: hqId, is_active: true },
            attributes: ['id', 'name', 'pincode', 'post_office', 'latitude', 'longitude', 'radius']
          });
        } catch (e) {
          console.warn(`[getAsmDateUsersOverview] allHqAreas query warning for HQ ${hqId}:`, e.message);
        }
      }

      hqSummaries.push({
        id: hq.id,
        name: hq.name,
        pincode: hq.pincode,
        latitude: hq.latitude,
        longitude: hq.longitude,
        state: hq.State ? { id: hq.State.id, name: hq.State.name } : null,
        total_msrs: hqUsers.length,
        total_users: hqUsers.length,
        msrs: hqUsers,
        users: hqUsers,
        day_areas_covered: Array.from(hqDayAreasMap.values()),
        all_areas: allHqAreas
      });
    }

    res.json({
      success: true,
      date: dateStr,
      asm: {
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role,
        employee_code: targetUser.employee_code,
        head_office: targetUser.HeadOffice ? {
          id: targetUser.HeadOffice.id,
          name: targetUser.HeadOffice.name,
          pincode: targetUser.HeadOffice.pincode
        } : null
      },
      total_assigned_hqs: targetHqIds.length,
      total_msrs: userCards.length,
      total_users: userCards.length,
      data: userCards,
      msrs: userCards,
      users: userCards,
      msr_details: userCards,
      head_offices: hqSummaries
    });
  } catch (error) {
    console.error('getAsmDateUsersOverview error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 2. Save ASM-Level Monthly Tour Plan Draft
 * ASM creates a day-wise plan by selecting assigned HQs instead of beats.
 * Validates that all selected HQs are strictly within ASM's assigned HQs!
 *
 * POST /api/tour-plans/asm/draft
 */
const saveAsmTourPlanDraft = async (req, res) => {
  const sequelize = getSequelize(req);
  const models = getModels(req);
  if (!models || !models.TourPlan || !models.TourPlanDay || !sequelize) {
    return res.status(500).json({
      success: false,
      message: 'Database models or instance not initialized'
    });
  }

  // Ensure tour_plans and tour_plan_days schema before executing
  await ensureTourPlanSchema(sequelize);

  const { TourPlan, TourPlanDay, User } = models;
  const { month, year, days } = req.body;

  if (!month || !year) {
    return res.status(400).json({
      success: false,
      message: 'Month and year are required'
    });
  }

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (monthNum < 1 || monthNum > 12) {
    return res.status(400).json({
      success: false,
      message: 'Month must be between 1 and 12'
    });
  }

  // 1. Fetch current ASM's assigned HQs for validation
  const currentUser = await User.findByPk(req.user.id);
  const assignedHqIds = await getAssignedHeadOfficeIds(currentUser, models);
  const assignedHqSet = new Set(assignedHqIds);

  // Validate that any selected HQ belongs to assigned HQs
  if (Array.isArray(days)) {
    for (const d of days) {
      if (d.head_office_id && !assignedHqSet.has(d.head_office_id) && !['Super Admin', 'Admin'].includes(req.user.role)) {
        return res.status(400).json({
          success: false,
          message: `Cannot select Head Office (${d.head_office_id}) for date ${d.date}: It is not in your assigned Head Offices list.`
        });
      }
      if (Array.isArray(d.head_office_ids)) {
        for (const hId of d.head_office_ids) {
          if (hId && !assignedHqSet.has(hId) && !['Super Admin', 'Admin'].includes(req.user.role)) {
            return res.status(400).json({
              success: false,
              message: `Cannot select Head Office (${hId}) for date ${d.date}: It is not in your assigned Head Offices list.`
            });
          }
        }
      }
    }
  }

  const transaction = await sequelize.transaction();

  try {
    // 2. Find or create TourPlan with plan_level = 'Manager'
    let plan = await TourPlan.findOne({
      where: {
        user_id: req.user.id,
        month: monthNum,
        year: yearNum
      },
      transaction
    });

    if (plan) {
      if (['Submitted', 'Approved'].includes(plan.status) && !['Super Admin', 'Admin'].includes(req.user.role)) {
        throw new Error(`Cannot modify plan that is already ${plan.status}. Please request correction or use day update.`);
      }
      if (plan.status === 'Returned') {
        plan.status = 'Draft';
      }
      plan.plan_level = 'Manager';
      await plan.save({ transaction });
    } else {
      plan = await TourPlan.create({
        user_id: req.user.id,
        month: monthNum,
        year: yearNum,
        status: 'Draft',
        plan_level: 'Manager'
      }, { transaction });
    }

    // 3. Clear existing days
    await TourPlanDay.destroy({
      where: { tour_plan_id: plan.id },
      transaction
    });

    // 4. Create new day records with HQ and co-work with RSM
    if (days && Array.isArray(days) && days.length > 0) {
      const dayRecords = days.map(d => {
        const hqId = d.head_office_id || null;
        const hqIds = Array.isArray(d.head_office_ids) ? d.head_office_ids : (hqId ? [hqId] : []);
        const normDayType = normalizeDayType(d.day_type);

        // Co-work with RSM / Joint work user
        const coworkUserId = d.co_work_with_user_id || d.rsm_user_id || d.joint_work_with_user_id || null;
        const coworkUserIds = coworkUserId ? [coworkUserId] : (Array.isArray(d.joint_work_user_ids) ? d.joint_work_user_ids : []);

        const statuses = {};
        coworkUserIds.forEach(uid => {
          statuses[uid] = (d.collaboration_statuses && d.collaboration_statuses[uid]) || 'Pending';
        });

        return {
          tour_plan_id: plan.id,
          date: d.date,
          day_type: normDayType,
          head_office_id: hqId,
          head_office_ids: hqIds,
          co_work_with_user_id: coworkUserId,
          joint_work_with_user_id: coworkUserId,
          joint_work_user_ids: coworkUserIds,
          collaboration_statuses: coworkUserIds.length > 0 ? statuses : {},
          collaboration_status: coworkUserIds.length > 0 ? (d.collaboration_status || 'Pending') : 'None',
          notes: d.notes || null
        };
      });

      await TourPlanDay.bulkCreate(dayRecords, { transaction });
    }

    await transaction.commit();

    // 5. Fetch enriched plan with complete HQ details and manager beats
    const enrichedPlan = await getEnrichedAsmPlan(plan.id, models);

    res.json({
      success: true,
      message: 'ASM monthly tour plan draft saved successfully',
      data: enrichedPlan
    });
  } catch (error) {
    await transaction.rollback();
    console.error('saveAsmTourPlanDraft error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 3. Edit / Update a Specific Day in ASM Tour Plan
 * "ASM can edit anything except assigned HQs any day and add operations of co-work with RSM."
 *
 * PUT /api/tour-plans/asm/day/:dayId
 * PUT /api/tour-plans/asm/day
 */
const updateAsmPlanDay = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.TourPlanDay || !models.TourPlan || !models.User) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    await ensureTourPlanSchema(sequelize);

    const { TourPlanDay, TourPlan, User } = models;
    const dayId = (req.params && req.params.dayId) || (req.body && (req.body.day_id || req.body.id));

    if (!dayId) {
      return res.status(400).json({
        success: false,
        message: 'Day ID is required'
      });
    }

    const planDay = await TourPlanDay.findByPk(dayId, {
      include: [{ model: TourPlan, as: 'tourPlan' }]
    });

    if (!planDay) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan day not found'
      });
    }

    // Verify ownership or manager level
    const isOwner = planDay.tourPlan && planDay.tourPlan.user_id === req.user.id;
    const isManager = MANAGER_LEVEL_ROLES.includes(req.user.role);

    if (!isOwner && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this tour plan day'
      });
    }

    const currentUser = await User.findByPk(req.user.id);
    const assignedHqIds = await getAssignedHeadOfficeIds(currentUser, models);
    const assignedHqSet = new Set(assignedHqIds);

    // Validate Head Office assignment if updating HQ:
    // "ASM can edit anything except assigned HQs any day" -> Cannot set an HQ outside assigned HQs
    if (req.body.head_office_id && !assignedHqSet.has(req.body.head_office_id) && !['Super Admin', 'Admin'].includes(req.user.role)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign Head Office (${req.body.head_office_id}): It is not in your assigned Head Offices list.`
      });
    }

    // Allowed edits on ANY day:
    // - day_type (Joint Work, Meeting, Office Work, Transit, Leave, Holiday, Field, Weekly off)
    // - notes
    // - head_office_id (within assigned HQs)
    // - head_office_ids
    // - co_work_with_user_id / rsm_user_id (co-work with RSM operations)
    if (req.body.day_type !== undefined) {
      planDay.day_type = normalizeDayType(req.body.day_type);
    }

    if (req.body.notes !== undefined) {
      planDay.notes = req.body.notes;
    }

    if (req.body.head_office_id !== undefined) {
      planDay.head_office_id = req.body.head_office_id;
    }

    if (Array.isArray(req.body.head_office_ids)) {
      planDay.head_office_ids = req.body.head_office_ids;
    }

    // Co-work with RSM / manager update
    if (req.body.co_work_with_user_id !== undefined || req.body.rsm_user_id !== undefined) {
      const coworkId = req.body.co_work_with_user_id || req.body.rsm_user_id || null;
      planDay.co_work_with_user_id = coworkId;
      planDay.joint_work_with_user_id = coworkId;
      planDay.joint_work_user_ids = coworkId ? [coworkId] : [];
      planDay.collaboration_status = coworkId ? (req.body.collaboration_status || 'Pending') : 'None';
      if (coworkId) {
        const statuses = planDay.collaboration_statuses || {};
        statuses[coworkId] = req.body.collaboration_status || 'Pending';
        planDay.collaboration_statuses = statuses;
      }
    }

    if (req.body.collaboration_status !== undefined) {
      planDay.collaboration_status = req.body.collaboration_status;
    }

    await planDay.save();

    // Re-fetch enriched day with HQ details and manager day beats
    let hqDetails = null;
    if (planDay.head_office_id) {
      hqDetails = await getHqDetailsWithManagersAndDayBeats(planDay.head_office_id, planDay.date, models);
    }

    let coWorker = null;
    if (planDay.co_work_with_user_id) {
      coWorker = await User.findByPk(planDay.co_work_with_user_id, {
        attributes: ['id', 'name', 'role', 'employee_code', 'email', 'mobile_number']
      });
    }

    res.json({
      success: true,
      message: 'Tour plan day updated successfully',
      data: {
        id: planDay.id,
        tour_plan_id: planDay.tour_plan_id,
        date: planDay.date,
        day_type: planDay.day_type,
        notes: planDay.notes,
        head_office_id: planDay.head_office_id,
        head_office_ids: planDay.head_office_ids,
        hq_details: hqDetails,
        co_work_with_user_id: planDay.co_work_with_user_id,
        co_worker: coWorker,
        collaboration_status: planDay.collaboration_status,
        handshake_status: planDay.handshake_status
      }
    });
  } catch (error) {
    console.error('updateAsmPlanDay error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 4. Helper to enrich an ASM monthly tour plan with complete HQ details,
 * active managers, and their mapped day beats.
 */
const getEnrichedAsmPlan = async (planId, models) => {
  const { TourPlan, TourPlanDay, User } = models;

  const plan = await TourPlan.findByPk(planId, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'role', 'employee_code', 'email', 'mobile_number']
      },
      {
        model: TourPlanDay,
        as: 'days',
        include: [
          {
            model: User,
            as: 'coWorkWith',
            attributes: ['id', 'name', 'role', 'employee_code', 'email', 'mobile_number']
          }
        ]
      }
    ],
    order: [[{ model: TourPlanDay, as: 'days' }, 'date', 'ASC']]
  });

  if (!plan) return null;

  const plainPlan = plan.toJSON ? plan.toJSON() : plan;

  // Enrich each day with HQ details, total manager count, and day beats mapped to those managers
  if (plainPlan.days && Array.isArray(plainPlan.days)) {
    const enrichedDays = [];
    for (const d of plainPlan.days) {
      let hqDetails = null;
      if (d.head_office_id) {
        hqDetails = await getHqDetailsWithManagersAndDayBeats(d.head_office_id, d.date, models);
      }

      enrichedDays.push({
        ...d,
        hq_details: hqDetails,
        co_worker: d.coWorkWith || null
      });
    }
    plainPlan.days = enrichedDays;
  }

  return plainPlan;
};

/**
 * 5. GET ASM Tour Plan by Month & Year or ID
 *
 * GET /api/tour-plans/asm/plan
 * GET /api/tour-plans/asm/plan/:id
 */
const getAsmPlan = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.TourPlan) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    await ensureTourPlanSchema(sequelize);

    const { TourPlan } = models;
    let plan = null;

    const paramId = (req.params && req.params.id) || (req.query && req.query.id);
    if (paramId) {
      plan = await getEnrichedAsmPlan(paramId, models);
    } else {
      const monthNum = parseInt(req.query.month || (new Date().getMonth() + 1), 10);
      const yearNum = parseInt(req.query.year || new Date().getFullYear(), 10);
      let targetUserId = req.user.id;

      if (req.query.user_id && ['Super Admin', 'Admin', 'Opps Team', 'National Head', 'State Head', 'Zonal Manager'].includes(req.user.role)) {
        targetUserId = req.query.user_id;
      }

      const foundPlan = await TourPlan.findOne({
        where: {
          user_id: targetUserId,
          month: monthNum,
          year: yearNum
        }
      });

      if (foundPlan) {
        plan = await getEnrichedAsmPlan(foundPlan.id, models);
      }
    }

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'ASM monthly tour plan not found for the requested period'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('getAsmPlan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 6. SUBMIT ASM Monthly Tour Plan for Approval
 *
 * POST /api/tour-plans/asm/:id/submit
 * POST /api/tour-plans/asm/submit
 */
const submitAsmTourPlan = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.TourPlan || !models.TourPlanDay) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    await ensureTourPlanSchema(sequelize);

    const { TourPlan, TourPlanDay } = models;
    const planId = (req.params && req.params.id) || (req.body && (req.body.plan_id || req.body.id));

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Tour plan ID is required'
      });
    }

    const plan = await TourPlan.findByPk(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan not found'
      });
    }

    if (plan.user_id !== req.user.id && !['Super Admin', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to submit this tour plan'
      });
    }

    if (['Submitted', 'Approved'].includes(plan.status)) {
      return res.status(400).json({
        success: false,
        message: `Plan is already ${plan.status}`
      });
    }

    const daysCount = await TourPlanDay.count({
      where: { tour_plan_id: plan.id }
    });

    if (daysCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit an empty tour plan. Please add days before submitting.'
      });
    }

    plan.status = 'Submitted';
    await plan.save();

    const enrichedPlan = await getEnrichedAsmPlan(plan.id, models);

    res.json({
      success: true,
      message: 'ASM monthly tour plan submitted successfully for approval',
      data: enrichedPlan
    });
  } catch (error) {
    console.error('submitAsmTourPlan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 7. GET My ASM Tour Plans History
 *
 * GET /api/tour-plans/asm/my-plans
 */
const getMyAsmPlans = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.TourPlan || !models.TourPlanDay) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    await ensureTourPlanSchema(sequelize);

    const { TourPlan, TourPlanDay } = models;
    let targetUserId = req.user.id;

    if (req.query.user_id && ['Super Admin', 'Admin', 'Opps Team', 'National Head', 'State Head', 'Zonal Manager'].includes(req.user.role)) {
      targetUserId = req.query.user_id;
    }

    const plans = await TourPlan.findAll({
      where: { user_id: targetUserId },
      include: [
        {
          model: TourPlanDay,
          as: 'days',
          attributes: ['id', 'date', 'day_type', 'head_office_id', 'co_work_with_user_id']
        }
      ],
      order: [
        ['year', 'DESC'],
        ['month', 'DESC']
      ]
    });

    const summary = plans.map(p => {
      const days = p.days || [];
      const hqSet = new Set(days.map(d => d.head_office_id).filter(Boolean));
      const coworkDays = days.filter(d => d.co_work_with_user_id || d.day_type === 'Joint Work').length;

      return {
        id: p.id,
        user_id: p.user_id,
        month: p.month,
        year: p.year,
        status: p.status,
        plan_level: p.plan_level || 'Manager',
        approved_by_name: p.approved_by_name,
        approved_by_role: p.approved_by_role,
        comments: p.comments,
        total_days: days.length,
        total_hqs_planned: hqSet.size,
        total_cowork_days: coworkDays,
        created_at: p.created_at,
        updated_at: p.updated_at
      };
    });

    res.json({
      success: true,
      count: summary.length,
      data: summary
    });
  } catch (error) {
    console.error('getMyAsmPlans error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 8. List Available RSMs / Managers / All-Level Users for Co-Work Operations
 * "add operations of co-work with RSM. (all level user) in this use for manager level
 * isIn: [['Super Admin', 'Admin', 'Opps Team', 'National Head', 'State Head', 'Zonal Manager', 'Area Manager', 'Manager', 'User', 'Accounts', 'Logistics']] manager"
 *
 * GET /api/tour-plans/asm/rsm-coworkers
 */
const getAsmRsmCoworkers = async (req, res) => {
  try {
    const models = getModels(req);
    if (!models || !models.User) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    const { User, HeadOffice, State } = models;
    const { role, search, state_id, only_managers } = req.query;

    const whereClause = {
      is_active: true,
      id: { [Op.ne]: req.user.id } // Exclude current user
    };

    if (only_managers === 'true') {
      whereClause.role = { [Op.in]: MANAGER_LEVEL_ROLES };
    } else if (role) {
      whereClause.role = role;
    } else {
      whereClause.role = { [Op.in]: ALL_VALID_ROLES };
    }

    if (state_id) {
      whereClause.state_id = state_id;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { employee_code: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'state_id', 'head_office_id'],
      include: [
        ...(HeadOffice ? [{ model: HeadOffice, attributes: ['id', 'name'] }] : []),
        ...(State ? [{ model: State, as: 'State', attributes: ['id', 'name'] }] : [])
      ],
      order: [
        ['role', 'ASC'],
        ['name', 'ASC']
      ]
    });

    const formatted = users.map(u => {
      const plain = u.toJSON ? u.toJSON() : u;
      return {
        id: plain.id,
        name: plain.name,
        role: plain.role,
        employee_code: plain.employee_code,
        email: plain.email,
        mobile_number: plain.mobile_number,
        head_office: plain.HeadOffice ? plain.HeadOffice.name : null,
        state: plain.State ? plain.State.name : null,
        is_rsm: RSM_ROLES.includes(plain.role),
        is_manager: MANAGER_LEVEL_ROLES.includes(plain.role)
      };
    });

    res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('getAsmRsmCoworkers error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 9. Add or Update Co-Work with RSM for a Specific Day
 *
 * POST /api/tour-plans/asm/day/:dayId/co-work
 */
const addOrUpdateCoWorkWithRsm = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.TourPlanDay || !models.User) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    await ensureTourPlanSchema(sequelize);

    const { TourPlanDay, User } = models;
    const dayId = (req.params && req.params.dayId) || (req.body && (req.body.day_id || req.body.id));
    const { rsm_user_id, co_work_with_user_id, notes, day_type } = req.body;

    const targetCoworkId = co_work_with_user_id || rsm_user_id;

    if (!targetCoworkId) {
      return res.status(400).json({
        success: false,
        message: 'RSM / Co-worker user ID is required'
      });
    }

    // Verify co-worker exists and has valid role
    const coworker = await User.findByPk(targetCoworkId, {
      attributes: ['id', 'name', 'role', 'employee_code', 'email', 'mobile_number', 'is_active']
    });

    if (!coworker || !coworker.is_active) {
      return res.status(404).json({
        success: false,
        message: 'RSM / Co-worker user not found or inactive'
      });
    }

    const planDay = await TourPlanDay.findByPk(dayId);
    if (!planDay) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan day not found'
      });
    }

    planDay.co_work_with_user_id = coworker.id;
    planDay.joint_work_with_user_id = coworker.id;
    planDay.joint_work_user_ids = [coworker.id];
    planDay.day_type = day_type ? normalizeDayType(day_type) : 'Joint Work';
    planDay.collaboration_status = 'Pending';

    const statuses = planDay.collaboration_statuses || {};
    statuses[coworker.id] = 'Pending';
    planDay.collaboration_statuses = statuses;

    if (notes) {
      planDay.notes = notes;
    }

    await planDay.save();

    res.json({
      success: true,
      message: `Co-work with RSM (${coworker.name}) requested successfully`,
      data: {
        id: planDay.id,
        date: planDay.date,
        day_type: planDay.day_type,
        notes: planDay.notes,
        head_office_id: planDay.head_office_id,
        co_work_with_user_id: coworker.id,
        co_worker: {
          id: coworker.id,
          name: coworker.name,
          role: coworker.role,
          employee_code: coworker.employee_code,
          email: coworker.email,
          mobile_number: coworker.mobile_number
        },
        collaboration_status: planDay.collaboration_status
      }
    });
  } catch (error) {
    console.error('addOrUpdateCoWorkWithRsm error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * 10. Respond to Co-Work Request (For the RSM / Co-worker)
 *
 * POST /api/tour-plans/asm/day/:dayId/co-work-respond
 */
const respondToCoWorkRequest = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.TourPlanDay) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    await ensureTourPlanSchema(sequelize);

    const { TourPlanDay, User } = models;
    const dayId = (req.params && req.params.dayId) || (req.body && (req.body.day_id || req.body.id));
    const { status, action, comments } = req.body;

    const responseStatus = status || (action === 'accept' ? 'Accepted' : (action === 'reject' ? 'Rejected' : null));

    if (!responseStatus || !['Accepted', 'Rejected'].includes(responseStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (Accepted or Rejected) is required'
      });
    }

    const planDay = await TourPlanDay.findByPk(dayId, {
      include: [
        {
          model: models.TourPlan,
          as: 'tourPlan',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'role', 'employee_code'] }]
        }
      ]
    });

    if (!planDay) {
      return res.status(404).json({
        success: false,
        message: 'Tour plan day not found'
      });
    }

    // Verify respondent
    const isCoworker = planDay.co_work_with_user_id === req.user.id || (Array.isArray(planDay.joint_work_user_ids) && planDay.joint_work_user_ids.includes(req.user.id));
    const isAdmin = ['Super Admin', 'Admin'].includes(req.user.role);

    if (!isCoworker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not the designated co-worker for this tour plan day'
      });
    }

    planDay.collaboration_status = responseStatus;
    const statuses = planDay.collaboration_statuses || {};
    statuses[req.user.id] = responseStatus;
    planDay.collaboration_statuses = statuses;

    if (comments) {
      planDay.change_request_comments = comments;
    }

    await planDay.save();

    res.json({
      success: true,
      message: `Co-work request ${responseStatus.toLowerCase()} successfully`,
      data: {
        id: planDay.id,
        date: planDay.date,
        day_type: planDay.day_type,
        collaboration_status: planDay.collaboration_status,
        asm: planDay.tourPlan ? planDay.tourPlan.user : null
      }
    });
  } catch (error) {
    console.error('respondToCoWorkRequest error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  ALL_VALID_ROLES,
  MANAGER_LEVEL_ROLES,
  RSM_ROLES,
  getAssignedHeadOfficeIds,
  getAsmHeadOfficesOverview,
  getAsmDateUsersOverview,
  getAsmUsersAndAreasByDate: getAsmDateUsersOverview,
  saveAsmTourPlanDraft,
  updateAsmPlanDay,
  getAsmPlan,
  submitAsmTourPlan,
  getMyAsmPlans,
  getAsmRsmCoworkers,
  addOrUpdateCoWorkWithRsm,
  respondToCoWorkRequest
};
