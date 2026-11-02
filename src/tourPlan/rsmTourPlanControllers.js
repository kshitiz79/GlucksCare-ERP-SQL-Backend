// src/tourPlan/rsmTourPlanControllers.js
/**
 * ============================================================================
 * RSM (Regional Sales Manager) LEVEL TOUR & PLAN CONTROLLERS
 * ============================================================================
 * Hierarchy: RSM -> HQ -> ASM -> MSR -> Beat -> Area
 *
 * Core Features:
 * 1. RSM Hierarchy API (RSM -> HQ -> ASM -> MSR -> Beat -> Area)
 * 2. Unassigned HQs API (HQs where no ASM plan is available for selected date/month)
 * 3. RSM Monthly Tour Plan Creation API (draft/plan with normal activities or unassigned HQs)
 * 4. RSM Tour Plan Edit API (allows updating selected ASM, HQ, activity, notes ANY day,
 *    even after approval, maintaining full update audit history)
 * 5. RSM Plan Fetch & Submit APIs
 */

const { Op } = require('sequelize');
const { ensureTourPlanSchema } = require('./ensureTourPlanSchema');

// Roles configuration
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

const RSM_LEVEL_ROLES = [
  'Super Admin',
  'Admin',
  'Opps Team',
  'National Head',
  'State Head',
  'Zonal Manager',
  'Manager'
];

const ASM_LEVEL_ROLES = [
  'Area Manager',
  'Manager',
  'Zonal Manager'
];

const getModels = (req) => {
  return req?.db || (req?.app && typeof req.app.get === 'function' && req.app.get('models')) || require('../config/database');
};

const getSequelize = (req) => {
  return req?.tenantSequelize || (req?.app && typeof req.app.get === 'function' && req.app.get('sequelize')) || require('../config/database').sequelize;
};

/**
 * Normalizes day types across standard and custom naming
 */
const normalizeDayType = (type) => {
  if (!type) return 'Field';
  const clean = String(type).trim();
  const lower = clean.toLowerCase();
  if (lower === 'joint work with asm' || lower === 'joint work' || lower === 'jointwork' || lower === 'co-work' || lower === 'cowork') {
    return 'Joint Work';
  }
  if (lower === 'office work' || lower === 'officework' || lower === 'office') return 'Office Work';
  if (lower === 'meeting') return 'Meeting';
  if (lower === 'transit') return 'Transit';
  if (lower === 'leave') return 'Leave';
  if (lower === 'holiday') return 'Holiday';
  if (lower === 'weekly off' || lower === 'weeklyoff' || lower === 'sunday') return 'Weekly off';
  if (lower === 'field') return 'Field';
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
 * Helper to get all Head Office IDs under an RSM:
 * 1. user.head_office_id (primary)
 * 2. user_head_offices (direct junction)
 * 3. user.headOffices association
 * 4. State Head / State HQs
 * 5. HQs of all ASMs reporting to this RSM via user_managers
 * 6. Admin fallback to all active HQs
 * 7. Deduplicate sister HQs by name
 */
const getRsmAssignedHeadOfficeIds = async (user, models) => {
  const m = models || require('../config/database');
  const UserHeadOffice = m.UserHeadOffice || (m.models && m.models.UserHeadOffice);
  const HeadOffice = m.HeadOffice || (m.models && m.models.HeadOffice);
  const UserManager = m.UserManager || (m.models && m.models.UserManager);
  const User = m.User || (m.models && m.models.User);
  const officeIds = new Set();

  if (!user) return [];

  // 1. Direct head_office_id
  if (user.head_office_id) {
    officeIds.add(user.head_office_id);
  }

  // 2. Junction table user_head_offices for RSM
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
      console.warn('[getRsmAssignedHeadOfficeIds] user_head_offices warning:', e.message);
    }
  }

  // 3. Associations
  if (user.headOffices && Array.isArray(user.headOffices)) {
    user.headOffices.forEach(ho => {
      if (ho.id) officeIds.add(ho.id);
    });
  }

  // 4. HQs of reporting ASMs/managers under this RSM
  if (UserManager && User) {
    try {
      const reportingPairs = await UserManager.findAll({
        where: { manager_id: user.id },
        attributes: ['user_id'],
        raw: true
      });
      const subUserIds = reportingPairs.map(p => p.user_id).filter(Boolean);
      if (subUserIds.length > 0) {
        const subUsers = await User.findAll({
          where: { id: { [Op.in]: subUserIds }, is_active: true },
          attributes: ['id', 'head_office_id'],
          raw: true
        });
        subUsers.forEach(su => {
          if (su.head_office_id) officeIds.add(su.head_office_id);
        });

        if (UserHeadOffice) {
          const subUhos = await UserHeadOffice.findAll({
            where: { user_id: { [Op.in]: subUserIds } },
            attributes: ['head_office_id'],
            raw: true
          });
          subUhos.forEach(su => {
            if (su.head_office_id) officeIds.add(su.head_office_id);
          });
        }
      }
    } catch (e) {
      console.warn('[getRsmAssignedHeadOfficeIds] UserManager reporting HQs warning:', e.message);
    }
  }

  // 5. State Head / State HQs
  if ((user.role === 'State Head' || user.role === 'Zonal Manager') && user.state_id && HeadOffice) {
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
      console.warn('[getRsmAssignedHeadOfficeIds] State Head query warning:', e.message);
    }
  }

  // 6. Super Admin / Admin fallback (all active HQs if none assigned directly)
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
      console.warn('[getRsmAssignedHeadOfficeIds] Admin all offices fallback warning:', e.message);
    }
  }

  // 7. Resolve duplicate Head Offices by normalized name
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
      console.warn('[getRsmAssignedHeadOfficeIds] duplicate name resolution warning:', e.message);
    }
  }

  return Array.from(officeIds).filter(Boolean);
};

/**
 * ============================================================================
 * 1. RSM-WISE HIERARCHY API
 * Hierarchy: RSM -> HQ -> ASM -> MSR -> Beat -> Area
 *
 * GET  /api/tour-plans/rsm/hierarchy
 * POST /api/tour-plans/rsm/hierarchy
 * GET  /api/tour-plans/rsm/hqs
 * POST /api/tour-plans/rsm/hqs
 * ============================================================================
 */
const getRsmHierarchyOverview = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.User || !models.HeadOffice) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    if (sequelize) {
      await ensureTourPlanSchema(sequelize);
    }

    const { User, HeadOffice, State, UserManager, UserHeadOffice, Beat, Area, TourPlan, TourPlanDay } = models;

    // 1. Identify Target RSM (allow viewing on behalf by Admin / National Head)
    let targetRsmId = req.user.id;
    const requestedUserId = req.body?.rsm_id || req.body?.user_id || req.query?.rsm_id || req.query?.user_id;
    if (requestedUserId && RSM_LEVEL_ROLES.includes(req.user.role)) {
      targetRsmId = requestedUserId;
    }

    const rsmUser = await User.findByPk(targetRsmId, {
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'state_id', 'head_office_id']
    });

    if (!rsmUser) {
      return res.status(404).json({
        success: false,
        message: 'RSM user not found'
      });
    }

    // Target date (defaults to today)
    const rawDate = req.body?.date || req.query?.date;
    const dateStr = normalizeDateStr(rawDate);

    // 2. Fetch all Head Offices under this RSM
    const assignedHqIds = await getRsmAssignedHeadOfficeIds(rsmUser, models);

    if (!assignedHqIds || assignedHqIds.length === 0) {
      return res.json({
        success: true,
        date: dateStr,
        rsm: {
          id: rsmUser.id,
          name: rsmUser.name,
          role: rsmUser.role,
          employee_code: rsmUser.employee_code,
          email: rsmUser.email
        },
        total_hqs: 0,
        unassigned_hqs_count: 0,
        hierarchy: []
      });
    }

    // Optional filter by single HQ
    const filterHqId = req.body?.head_office_id || req.query?.head_office_id;
    let targetHqIds = assignedHqIds;
    if (filterHqId) {
      if (!assignedHqIds.includes(filterHqId) && !['Super Admin', 'Admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'The requested Head Office is not under your RSM jurisdiction'
        });
      }
      targetHqIds = [filterHqId];
    }

    // 3. Fetch all HQs with State
    const hqRecords = await HeadOffice.findAll({
      where: { id: { [Op.in]: targetHqIds }, is_active: true },
      include: State ? [{ model: State, attributes: ['id', 'name'] }] : [],
      order: [['name', 'ASC']]
    });

    // 4. Find all users mapped to these HQs (direct head_office_id + UserHeadOffice)
    const directUsers = await User.findAll({
      where: {
        head_office_id: { [Op.in]: targetHqIds },
        is_active: true,
        role: { [Op.in]: ALL_VALID_ROLES }
      },
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'head_office_id', 'designation_id'],
      raw: true
    });

    let junctionMappings = [];
    if (UserHeadOffice) {
      junctionMappings = await UserHeadOffice.findAll({
        where: { head_office_id: { [Op.in]: targetHqIds } },
        attributes: ['user_id', 'head_office_id'],
        raw: true
      });
    }

    // Build map of hqId -> Set of userIds
    const hqToUserIds = new Map();
    targetHqIds.forEach(id => hqToUserIds.set(id, new Set()));

    directUsers.forEach(u => {
      if (hqToUserIds.has(u.head_office_id)) {
        hqToUserIds.get(u.head_office_id).add(u.id);
      }
    });

    junctionMappings.forEach(j => {
      if (hqToUserIds.has(j.head_office_id)) {
        hqToUserIds.get(j.head_office_id).add(j.user_id);
      }
    });

    // Collect all distinct user IDs
    const allDistinctUserIds = new Set();
    hqToUserIds.forEach(set => set.forEach(uid => allDistinctUserIds.add(uid)));

    // Load full user details
    const usersList = await User.findAll({
      where: { id: { [Op.in]: Array.from(allDistinctUserIds) }, is_active: true },
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'head_office_id', 'designation_id']
    });
    const userMap = new Map();
    usersList.forEach(u => userMap.set(u.id, u.toJSON ? u.toJSON() : u));

    // Load reporting manager relationships (UserManager)
    let managerRelations = [];
    if (UserManager) {
      managerRelations = await UserManager.findAll({
        where: {
          [Op.or]: [
            { manager_id: targetRsmId },
            { manager_id: { [Op.in]: Array.from(allDistinctUserIds) } },
            { user_id: { [Op.in]: Array.from(allDistinctUserIds) } }
          ]
        },
        raw: true
      });
    }

    // Map: asmId -> Set of reporting msrIds
    const asmToMsrsMap = new Map();
    // Map: msrId -> asmId
    const msrToAsmMap = new Map();

    managerRelations.forEach(r => {
      if (!asmToMsrsMap.has(r.manager_id)) {
        asmToMsrsMap.set(r.manager_id, new Set());
      }
      asmToMsrsMap.get(r.manager_id).add(r.user_id);
      msrToAsmMap.set(r.user_id, r.manager_id);
    });

    // 5. Preload TourPlanDay for all distinct users on dateStr
    const userDayPlans = new Map(); // userId -> TourPlanDay object
    if (TourPlanDay && TourPlan) {
      const dayPlans = await TourPlanDay.findAll({
        where: { date: dateStr },
        include: [
          {
            model: TourPlan,
            as: 'tourPlan',
            where: { user_id: { [Op.in]: Array.from(allDistinctUserIds) } },
            attributes: ['id', 'user_id', 'status', 'month', 'year']
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

      dayPlans.forEach(dp => {
        const plain = dp.toJSON ? dp.toJSON() : dp;
        if (plain.tourPlan && plain.tourPlan.user_id) {
          userDayPlans.set(plain.tourPlan.user_id, plain);
        }
      });
    }

    // 6. Preload default beats for all MSRs (fallback if day plan has no beats)
    const msrDefaultBeatsMap = new Map();
    if (Beat) {
      const defaultBeats = await Beat.findAll({
        where: {
          user_id: { [Op.in]: Array.from(allDistinctUserIds) },
          is_active: true
        },
        attributes: ['id', 'name', 'color', 'user_id'],
        include: Area ? [{
          model: Area,
          as: 'areas',
          attributes: ['id', 'name', 'pincode', 'post_office', 'head_office_id', 'latitude', 'longitude', 'radius'],
          through: { attributes: [] }
        }] : []
      });

      defaultBeats.forEach(b => {
        const plain = b.toJSON ? b.toJSON() : b;
        if (!msrDefaultBeatsMap.has(plain.user_id)) {
          msrDefaultBeatsMap.set(plain.user_id, []);
        }
        msrDefaultBeatsMap.get(plain.user_id).push(plain);
      });
    }

    // 7. BUILD COMPLETE HIERARCHY: RSM -> HQ -> ASM -> MSR -> Beat -> Area
    const hierarchyHqs = [];
    const unassignedHqsList = [];

    for (const hq of hqRecords) {
      const hqPlain = hq.toJSON ? hq.toJSON() : hq;
      const hqUserIds = Array.from(hqToUserIds.get(hq.id) || []);
      const hqUsers = hqUserIds.map(uid => userMap.get(uid)).filter(Boolean);

      // Separate ASMs and MSRs
      // ASM: role in ASM_LEVEL_ROLES or reports directly to RSM
      const hqAsms = hqUsers.filter(u => {
        return ASM_LEVEL_ROLES.includes(u.role) || (msrToAsmMap.get(u.id) === targetRsmId);
      });

      // MSRs: role === 'User' or non-manager roles
      const hqMsrs = hqUsers.filter(u => {
        return u.role === 'User' || (!ASM_LEVEL_ROLES.includes(u.role) && !RSM_LEVEL_ROLES.includes(u.role));
      });

      // Track if any ASM under this HQ has an active work plan for dateStr
      let hasAsmPlanForDate = false;
      const asmNodes = [];

      // A. Populate ASMs and their subordinate MSRs
      for (const asm of hqAsms) {
        const asmDayPlan = userDayPlans.get(asm.id);
        const hasPlan = !!asmDayPlan;
        if (hasPlan && !['Leave', 'Holiday'].includes(asmDayPlan.day_type)) {
          hasAsmPlanForDate = true;
        }

        // Find MSRs reporting to this ASM in this HQ (or mapped to this HQ)
        const reportingMsrIds = asmToMsrsMap.get(asm.id) || new Set();
        const asmSubordinateMsrs = hqMsrs.filter(msr => {
          return reportingMsrIds.has(msr.id) || msrToAsmMap.get(msr.id) === asm.id;
        });

        // If no direct reporting is mapped, fall back to sharing this HQ
        const finalMsrs = asmSubordinateMsrs.length > 0 ? asmSubordinateMsrs : hqMsrs;

        const msrNodes = [];
        for (const msr of finalMsrs) {
          const msrDayPlan = userDayPlans.get(msr.id);

          // Extract day beats or fallback to default beats
          let beats = [];
          if (msrDayPlan) {
            if (msrDayPlan.beat1) beats.push(msrDayPlan.beat1);
            if (msrDayPlan.beat2) beats.push(msrDayPlan.beat2);
          }
          if (beats.length === 0 && msrDefaultBeatsMap.has(msr.id)) {
            beats = msrDefaultBeatsMap.get(msr.id);
          }

          const formattedBeats = beats.map(b => ({
            beat_id: b.id,
            beat_name: b.name,
            color: b.color,
            areas: (b.areas || []).map(a => ({
              area_id: a.id,
              area_name: a.name,
              pincode: a.pincode,
              post_office: a.post_office,
              latitude: a.latitude,
              longitude: a.longitude,
              radius: a.radius
            }))
          }));

          msrNodes.push({
            msr_id: msr.id,
            msr_name: msr.name,
            employee_code: msr.employee_code,
            email: msr.email,
            mobile_number: msr.mobile_number,
            role: msr.role,
            plan_for_date: msrDayPlan ? {
              day_id: msrDayPlan.id,
              date: msrDayPlan.date,
              day_type: msrDayPlan.day_type,
              notes: msrDayPlan.notes,
              status: msrDayPlan.tourPlan ? msrDayPlan.tourPlan.status : 'Draft'
            } : {
              date: dateStr,
              day_type: 'Not Planned',
              status: 'None'
            },
            total_beats: formattedBeats.length,
            beats: formattedBeats
          });
        }

        asmNodes.push({
          asm_id: asm.id,
          asm_name: asm.name,
          employee_code: asm.employee_code,
          email: asm.email,
          mobile_number: asm.mobile_number,
          role: asm.role,
          has_plan: hasPlan,
          plan_for_date: asmDayPlan ? {
            day_id: asmDayPlan.id,
            date: asmDayPlan.date,
            day_type: asmDayPlan.day_type,
            notes: asmDayPlan.notes,
            head_office_id: asmDayPlan.head_office_id,
            status: asmDayPlan.tourPlan ? asmDayPlan.tourPlan.status : 'Draft',
            collaboration_status: asmDayPlan.collaboration_status
          } : null,
          total_msrs: msrNodes.length,
          msrs: msrNodes
        });
      }

      // If HQ has MSRs but no ASM assigned at all, create an unassigned ASM placeholder node
      if (asmNodes.length === 0 && hqMsrs.length > 0) {
        const msrNodes = hqMsrs.map(msr => {
          const msrDayPlan = userDayPlans.get(msr.id);
          let beats = [];
          if (msrDayPlan) {
            if (msrDayPlan.beat1) beats.push(msrDayPlan.beat1);
            if (msrDayPlan.beat2) beats.push(msrDayPlan.beat2);
          }
          if (beats.length === 0 && msrDefaultBeatsMap.has(msr.id)) {
            beats = msrDefaultBeatsMap.get(msr.id);
          }

          return {
            msr_id: msr.id,
            msr_name: msr.name,
            employee_code: msr.employee_code,
            email: msr.email,
            mobile_number: msr.mobile_number,
            role: msr.role,
            plan_for_date: msrDayPlan ? {
              day_id: msrDayPlan.id,
              date: msrDayPlan.date,
              day_type: msrDayPlan.day_type,
              notes: msrDayPlan.notes,
              status: msrDayPlan.tourPlan ? msrDayPlan.tourPlan.status : 'Draft'
            } : {
              date: dateStr,
              day_type: 'Not Planned',
              status: 'None'
            },
            total_beats: beats.length,
            beats: beats.map(b => ({
              beat_id: b.id,
              beat_name: b.name,
              color: b.color,
              areas: (b.areas || []).map(a => ({
                area_id: a.id,
                area_name: a.name,
                pincode: a.pincode,
                post_office: a.post_office
              }))
            }))
          };
        });

        asmNodes.push({
          asm_id: null,
          asm_name: 'Unassigned ASM (Direct MSRs)',
          role: 'None',
          has_plan: false,
          plan_for_date: null,
          total_msrs: msrNodes.length,
          msrs: msrNodes
        });
      }

      const isUnassignedHq = !hasAsmPlanForDate;

      const hqNode = {
        hq_id: hqPlain.id,
        hq_name: hqPlain.name,
        pincode: hqPlain.pincode,
        state: hqPlain.State ? hqPlain.State.name : null,
        is_assigned_to_asm: hqAsms.length > 0,
        has_asm_plan_for_date: hasAsmPlanForDate,
        is_unassigned_hq_for_date: isUnassignedHq,
        unassigned_reason: isUnassignedHq
          ? (hqAsms.length === 0 ? 'No ASM assigned to this HQ' : 'No ASM work plan available for this date')
          : null,
        total_asms: hqAsms.length,
        total_msrs: hqMsrs.length,
        asms: asmNodes
      };

      hierarchyHqs.push(hqNode);

      if (isUnassignedHq) {
        unassignedHqsList.push({
          head_office_id: hqPlain.id,
          head_office_name: hqPlain.name,
          pincode: hqPlain.pincode,
          state: hqPlain.State ? hqPlain.State.name : null,
          reason: hqNode.unassigned_reason,
          total_msrs: hqMsrs.length,
          msrs: hqMsrs.map(m => ({
            id: m.id,
            name: m.name,
            employee_code: m.employee_code,
            role: m.role
          }))
        });
      }
    }

    res.json({
      success: true,
      date: dateStr,
      rsm: {
        id: rsmUser.id,
        name: rsmUser.name,
        role: rsmUser.role,
        employee_code: rsmUser.employee_code,
        email: rsmUser.email
      },
      total_hqs: hierarchyHqs.length,
      unassigned_hqs_count: unassignedHqsList.length,
      unassigned_hqs: unassignedHqsList,
      hierarchy: hierarchyHqs
    });
  } catch (error) {
    console.error('getRsmHierarchyOverview error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * ============================================================================
 * 2. UNASSIGNED HQS API (DATE-WISE & MONTH-WISE)
 * "An unassigned HQ means an HQ where no ASM plan is available for the selected
 * date. The API should return all such unassigned HQs date-wise, so the RSM
 * can select one HQ and plan a visit/activity for it."
 *
 * GET  /api/tour-plans/rsm/unassigned-hqs
 * POST /api/tour-plans/rsm/unassigned-hqs
 * ============================================================================
 */
const getRsmUnassignedHqs = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.User || !models.HeadOffice) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    if (sequelize) {
      await ensureTourPlanSchema(sequelize);
    }

    const { User, HeadOffice, State, UserManager, UserHeadOffice, TourPlan, TourPlanDay } = models;

    // Target RSM
    let targetRsmId = req.user.id;
    const requestedUserId = req.body?.rsm_id || req.body?.user_id || req.query?.rsm_id || req.query?.user_id;
    if (requestedUserId && RSM_LEVEL_ROLES.includes(req.user.role)) {
      targetRsmId = requestedUserId;
    }

    const rsmUser = await User.findByPk(targetRsmId);
    if (!rsmUser) {
      return res.status(404).json({
        success: false,
        message: 'RSM user not found'
      });
    }

    // Determine mode: single date query OR month-wise query
    const rawDate = req.body?.date || req.query?.date;
    const month = req.body?.month || req.query?.month;
    const year = req.body?.year || req.query?.year;

    // Get all HQs under this RSM
    const assignedHqIds = await getRsmAssignedHeadOfficeIds(rsmUser, models);
    if (!assignedHqIds || assignedHqIds.length === 0) {
      return res.json({
        success: true,
        rsm_id: rsmUser.id,
        total_hqs: 0,
        data: []
      });
    }

    const hqs = await HeadOffice.findAll({
      where: { id: { [Op.in]: assignedHqIds }, is_active: true },
      include: State ? [{ model: State, attributes: ['id', 'name'] }] : [],
      order: [['name', 'ASC']]
    });

    // Find all ASMs under these HQs
    const directAsms = await User.findAll({
      where: {
        head_office_id: { [Op.in]: assignedHqIds },
        is_active: true,
        role: { [Op.in]: ASM_LEVEL_ROLES }
      },
      attributes: ['id', 'name', 'role', 'head_office_id'],
      raw: true
    });

    let junctionAsms = [];
    if (UserHeadOffice) {
      junctionAsms = await UserHeadOffice.findAll({
        where: { head_office_id: { [Op.in]: assignedHqIds } },
        include: [{
          model: User,
          where: { is_active: true, role: { [Op.in]: ASM_LEVEL_ROLES } },
          attributes: ['id', 'name', 'role']
        }],
        raw: true,
        nest: true
      });
    }

    // Map: hqId -> Set of ASM user IDs
    const hqToAsmIds = new Map();
    assignedHqIds.forEach(id => hqToAsmIds.set(id, new Set()));

    directAsms.forEach(a => {
      if (hqToAsmIds.has(a.head_office_id)) {
        hqToAsmIds.get(a.head_office_id).add(a.id);
      }
    });

    junctionAsms.forEach(j => {
      if (j.head_office_id && j.User && hqToAsmIds.has(j.head_office_id)) {
        hqToAsmIds.get(j.head_office_id).add(j.User.id);
      }
    });

    const allAsmIds = new Set();
    hqToAsmIds.forEach(set => set.forEach(aid => allAsmIds.add(aid)));

    // CASE A: Month-Wise query (returns date-wise unassigned HQs for all days of the month)
    if (month && year) {
      const mNum = parseInt(month, 10);
      const yNum = parseInt(year, 10);
      const daysInMonth = new Date(yNum, mNum, 0).getDate();

      // Preload all ASM tour plan days for this month
      const startDate = `${yNum}-${String(mNum).padStart(2, '0')}-01`;
      const endDate = `${yNum}-${String(mNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      const asmDays = await TourPlanDay.findAll({
        where: {
          date: { [Op.between]: [startDate, endDate] }
        },
        include: [{
          model: TourPlan,
          as: 'tourPlan',
          where: { user_id: { [Op.in]: Array.from(allAsmIds) } },
          attributes: ['id', 'user_id', 'status']
        }],
        attributes: ['id', 'date', 'day_type', 'head_office_id']
      });

      // Map: date -> Set of asmIds with active plan
      const dateToActiveAsms = new Map();
      asmDays.forEach(ad => {
        const dStr = ad.date;
        if (!dateToActiveAsms.has(dStr)) {
          dateToActiveAsms.set(dStr, new Set());
        }
        if (!['Leave', 'Holiday'].includes(ad.day_type) && ad.tourPlan) {
          dateToActiveAsms.get(dStr).add(ad.tourPlan.user_id);
        }
      });

      // Construct date-wise result
      const dateWiseResults = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const curDate = `${yNum}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const activeAsmsOnDate = dateToActiveAsms.get(curDate) || new Set();

        const unassignedOnDate = [];
        for (const hq of hqs) {
          const asmIdsInHq = hqToAsmIds.get(hq.id) || new Set();
          let hasPlan = false;

          for (const aid of asmIdsInHq) {
            if (activeAsmsOnDate.has(aid)) {
              hasPlan = true;
              break;
            }
          }

          if (!hasPlan) {
            unassignedOnDate.push({
              head_office_id: hq.id,
              head_office_name: hq.name,
              pincode: hq.pincode,
              state: hq.State ? hq.State.name : null,
              has_assigned_asm: asmIdsInHq.size > 0,
              total_asms: asmIdsInHq.size,
              reason: asmIdsInHq.size === 0 ? 'No ASM assigned to this HQ' : 'No ASM work plan available for this date'
            });
          }
        }

        dateWiseResults.push({
          date: curDate,
          day_number: day,
          unassigned_count: unassignedOnDate.length,
          unassigned_hqs: unassignedOnDate
        });
      }

      return res.json({
        success: true,
        month: mNum,
        year: yNum,
        total_days: daysInMonth,
        total_assigned_hqs: hqs.length,
        dates: dateWiseResults
      });
    }

    // CASE B: Single Date Query
    const dateStr = normalizeDateStr(rawDate);

    // Preload ASM day plans for dateStr
    const asmDays = await TourPlanDay.findAll({
      where: { date: dateStr },
      include: [{
        model: TourPlan,
        as: 'tourPlan',
        where: { user_id: { [Op.in]: Array.from(allAsmIds) } },
        attributes: ['id', 'user_id', 'status']
      }],
      attributes: ['id', 'date', 'day_type', 'head_office_id']
    });

    const activeAsmsOnDate = new Set();
    asmDays.forEach(ad => {
      if (!['Leave', 'Holiday'].includes(ad.day_type) && ad.tourPlan) {
        activeAsmsOnDate.add(ad.tourPlan.user_id);
      }
    });

    const unassignedHqs = [];
    for (const hq of hqs) {
      const asmIdsInHq = hqToAsmIds.get(hq.id) || new Set();
      let hasPlan = false;

      for (const aid of asmIdsInHq) {
        if (activeAsmsOnDate.has(aid)) {
          hasPlan = true;
          break;
        }
      }

      if (!hasPlan) {
        unassignedHqs.push({
          head_office_id: hq.id,
          head_office_name: hq.name,
          pincode: hq.pincode,
          state: hq.State ? hq.State.name : null,
          has_assigned_asm: asmIdsInHq.size > 0,
          total_asms: asmIdsInHq.size,
          reason: asmIdsInHq.size === 0 ? 'No ASM assigned to this HQ' : 'No ASM work plan available for this date'
        });
      }
    }

    res.json({
      success: true,
      date: dateStr,
      total_hqs: hqs.length,
      unassigned_count: unassignedHqs.length,
      unassigned_hqs: unassignedHqs
    });
  } catch (error) {
    console.error('getRsmUnassignedHqs error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * ============================================================================
 * 3. SAVE RSM-LEVEL MONTHLY TOUR PLAN DRAFT
 * "Create an RSM-level monthly Tour Plan API where the RSM creates their own
 * day-wise plan. For each selected day, the RSM can select a normal RSM activity,
 * such as Joint Work with ASM, Meeting, Office Work, Transit, Leave, or Holiday,
 * or select any unassigned HQ under that RSM as their plan for that day."
 *
 * POST /api/tour-plans/rsm/draft
 * ============================================================================
 */
const saveRsmTourPlanDraft = async (req, res) => {
  const sequelize = getSequelize(req);
  const models = getModels(req);
  if (!models || !models.TourPlan || !models.TourPlanDay || !sequelize) {
    return res.status(500).json({
      success: false,
      message: 'Database models or instance not initialized'
    });
  }

  // Ensure tour_plans and tour_plan_days schema
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

  // Fetch RSM assigned HQs for validation
  const currentUser = await User.findByPk(req.user.id);
  const assignedHqIds = await getRsmAssignedHeadOfficeIds(currentUser, models);
  const assignedHqSet = new Set(assignedHqIds);

  // Validate that any selected HQ belongs to RSM's assigned HQs
  if (Array.isArray(days)) {
    for (const d of days) {
      if (d.head_office_id && !assignedHqSet.has(d.head_office_id) && !['Super Admin', 'Admin'].includes(req.user.role)) {
        return res.status(400).json({
          success: false,
          message: `Cannot select Head Office (${d.head_office_id}) for date ${d.date}: It is not under your assigned RSM jurisdiction.`
        });
      }
    }
  }

  const transaction = await sequelize.transaction();

  try {
    // 1. Find or create TourPlan with plan_level = 'RSM'
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
        throw new Error(`Plan is already ${plan.status}. Use day update API (/api/tour-plans/rsm/day) to modify day plans.`);
      }
      if (plan.status === 'Returned') {
        plan.status = 'Draft';
      }
      plan.plan_level = 'RSM';
      await plan.save({ transaction });
    } else {
      plan = await TourPlan.create({
        user_id: req.user.id,
        month: monthNum,
        year: yearNum,
        status: 'Draft',
        plan_level: 'RSM'
      }, { transaction });
    }

    // 2. Upsert days
    if (Array.isArray(days)) {
      for (const d of days) {
        if (!d.date) continue;
        const normalizedType = normalizeDayType(d.day_type);
        const selectedAsmId = d.selected_asm_id || d.asm_id || d.co_work_with_user_id || null;

        let planDay = await TourPlanDay.findOne({
          where: {
            tour_plan_id: plan.id,
            date: d.date
          },
          transaction
        });

        const dayPayload = {
          day_type: normalizedType,
          notes: d.notes || null,
          head_office_id: d.head_office_id || null,
          head_office_ids: Array.isArray(d.head_office_ids) ? d.head_office_ids : (d.head_office_id ? [d.head_office_id] : []),
          selected_asm_id: selectedAsmId,
          asm_tour_plan_day_id: d.asm_tour_plan_day_id || null,
          is_unassigned_hq: !!d.is_unassigned_hq,
          co_work_with_user_id: selectedAsmId,
          joint_work_with_user_id: selectedAsmId,
          joint_work_user_ids: selectedAsmId ? [selectedAsmId] : [],
          collaboration_status: selectedAsmId ? (d.collaboration_status || 'Pending') : 'None',
          last_updated_by_id: req.user.id,
          last_updated_by_name: req.user.name,
          last_updated_at: new Date()
        };

        if (planDay) {
          await planDay.update(dayPayload, { transaction });
        } else {
          await TourPlanDay.create({
            tour_plan_id: plan.id,
            date: d.date,
            ...dayPayload
          }, { transaction });
        }
      }
    }

    await transaction.commit();

    const enriched = await getEnrichedRsmPlan(plan.id, models);

    res.json({
      success: true,
      message: 'RSM monthly tour plan draft saved successfully',
      data: enriched
    });
  } catch (error) {
    await transaction.rollback();
    console.error('saveRsmTourPlanDraft error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * ============================================================================
 * 4. RSM TOUR PLAN EDIT API (UPDATE ANY DAY, EVEN AFTER APPROVAL)
 * "Create an RSM Tour Plan edit API that allows the RSM to update the ASM work
 * plan selected for any day in their monthly plan. If the RSM selected an ASM’s
 * work plan or Joint Work with an ASM for a particular date, the RSM must be
 * able to change that selection, selected ASM, HQ, activity type, or notes for
 * any day, even after the RSM tour plan has been approved. The API should save
 * the updated day plan and maintain the latest update details."
 *
 * PUT /api/tour-plans/rsm/day/:dayId
 * PUT /api/tour-plans/rsm/day
 * ============================================================================
 */
const updateRsmPlanDay = async (req, res) => {
  try {
    const sequelize = getSequelize(req);
    const models = getModels(req);
    if (!models || !models.TourPlan || !models.TourPlanDay || !sequelize) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    await ensureTourPlanSchema(sequelize);

    const { TourPlanDay, TourPlan, User, HeadOffice } = models;

    // Locate the target day
    const dayId = req.params?.dayId || req.body?.day_id || req.body?.id;
    const { date, month, year, tour_plan_id } = req.body;

    let planDay = null;

    if (dayId) {
      planDay = await TourPlanDay.findByPk(dayId, {
        include: [{ model: TourPlan, as: 'tourPlan' }]
      });
    } else if (date) {
      // Find by date and user
      let planId = tour_plan_id;
      if (!planId && month && year) {
        const plan = await TourPlan.findOne({
          where: { user_id: req.user.id, month: parseInt(month, 10), year: parseInt(year, 10) }
        });
        if (plan) planId = plan.id;
      }

      if (planId) {
        planDay = await TourPlanDay.findOne({
          where: { tour_plan_id: planId, date },
          include: [{ model: TourPlan, as: 'tourPlan' }]
        });
      }
    }

    if (!planDay) {
      return res.status(404).json({
        success: false,
        message: 'RSM tour plan day not found'
      });
    }

    // Verify ownership or manager level
    const isOwner = planDay.tourPlan && planDay.tourPlan.user_id === req.user.id;
    const isManager = RSM_LEVEL_ROLES.includes(req.user.role);

    if (!isOwner && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this RSM tour plan day'
      });
    }

    // Validate HQ jurisdiction
    const currentUser = await User.findByPk(req.user.id);
    const assignedHqIds = await getRsmAssignedHeadOfficeIds(currentUser, models);
    const assignedHqSet = new Set(assignedHqIds);

    if (req.body.head_office_id && !assignedHqSet.has(req.body.head_office_id) && !['Super Admin', 'Admin'].includes(req.user.role)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign Head Office (${req.body.head_office_id}): It is not in your assigned RSM Head Offices.`
      });
    }

    // Capture previous state for audit log
    const previousState = {
      day_type: planDay.day_type,
      selected_asm_id: planDay.selected_asm_id,
      asm_tour_plan_day_id: planDay.asm_tour_plan_day_id,
      head_office_id: planDay.head_office_id,
      head_office_ids: planDay.head_office_ids,
      is_unassigned_hq: planDay.is_unassigned_hq,
      notes: planDay.notes,
      co_work_with_user_id: planDay.co_work_with_user_id
    };

    // Apply updates on ANY day (even after approval as requested!)
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

    if (req.body.is_unassigned_hq !== undefined) {
      planDay.is_unassigned_hq = !!req.body.is_unassigned_hq;
    }

    if (req.body.asm_tour_plan_day_id !== undefined) {
      planDay.asm_tour_plan_day_id = req.body.asm_tour_plan_day_id;
    }

    // Update selected ASM
    if (req.body.selected_asm_id !== undefined || req.body.asm_id !== undefined || req.body.co_work_with_user_id !== undefined) {
      const asmId = req.body.selected_asm_id || req.body.asm_id || req.body.co_work_with_user_id || null;
      planDay.selected_asm_id = asmId;
      planDay.co_work_with_user_id = asmId;
      planDay.joint_work_with_user_id = asmId;
      planDay.joint_work_user_ids = asmId ? [asmId] : [];
      planDay.collaboration_status = asmId ? (req.body.collaboration_status || 'Pending') : 'None';
    }

    // Audit and update tracking
    const updateTime = new Date();
    planDay.last_updated_by_id = req.user.id;
    planDay.last_updated_by_name = req.user.name;
    planDay.last_updated_at = updateTime;

    const history = Array.isArray(planDay.edit_history) ? [...planDay.edit_history] : [];
    const newState = {
      day_type: planDay.day_type,
      selected_asm_id: planDay.selected_asm_id,
      asm_tour_plan_day_id: planDay.asm_tour_plan_day_id,
      head_office_id: planDay.head_office_id,
      head_office_ids: planDay.head_office_ids,
      is_unassigned_hq: planDay.is_unassigned_hq,
      notes: planDay.notes,
      co_work_with_user_id: planDay.co_work_with_user_id
    };

    history.push({
      timestamp: updateTime.toISOString(),
      updated_by_id: req.user.id,
      updated_by_name: req.user.name,
      previous_state: previousState,
      new_state: newState,
      reason: req.body.change_reason || req.body.notes || 'Day plan updated by RSM'
    });

    planDay.edit_history = history;

    await planDay.save();

    // Increment direct_changes_count on parent TourPlan
    if (planDay.tourPlan) {
      await planDay.tourPlan.increment('direct_changes_count', { by: 1 });
    }

    // Enrich day with HQ and ASM details
    let hqDetails = null;
    if (planDay.head_office_id && HeadOffice) {
      hqDetails = await HeadOffice.findByPk(planDay.head_office_id, {
        attributes: ['id', 'name', 'pincode']
      });
    }

    let selectedAsmDetails = null;
    if (planDay.selected_asm_id && User) {
      selectedAsmDetails = await User.findByPk(planDay.selected_asm_id, {
        attributes: ['id', 'name', 'role', 'employee_code', 'email', 'mobile_number']
      });
    }

    res.json({
      success: true,
      message: 'RSM tour plan day updated successfully',
      data: {
        id: planDay.id,
        tour_plan_id: planDay.tour_plan_id,
        date: planDay.date,
        day_type: planDay.day_type,
        notes: planDay.notes,
        head_office_id: planDay.head_office_id,
        head_office_ids: planDay.head_office_ids,
        hq_details: hqDetails,
        selected_asm_id: planDay.selected_asm_id,
        selected_asm: selectedAsmDetails,
        asm_tour_plan_day_id: planDay.asm_tour_plan_day_id,
        is_unassigned_hq: planDay.is_unassigned_hq,
        last_updated_by: {
          id: planDay.last_updated_by_id,
          name: planDay.last_updated_by_name,
          updated_at: planDay.last_updated_at
        },
        edit_history: planDay.edit_history
      }
    });
  } catch (error) {
    console.error('updateRsmPlanDay error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * ============================================================================
 * 5. GET RSM TOUR PLAN (BY MONTH/YEAR OR ID) & MY PLANS
 *
 * GET /api/tour-plans/rsm/plan
 * GET /api/tour-plans/rsm/plan/:id
 * GET /api/tour-plans/rsm/my-plans
 * ============================================================================
 */
const getEnrichedRsmPlan = async (planId, models) => {
  const { TourPlan, TourPlanDay, User, HeadOffice } = models;

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
            as: 'selectedAsm',
            attributes: ['id', 'name', 'role', 'employee_code', 'email', 'mobile_number']
          },
          {
            model: User,
            as: 'coWorkWith',
            attributes: ['id', 'name', 'role', 'employee_code', 'email', 'mobile_number']
          },
          ...(HeadOffice ? [{
            model: HeadOffice,
            as: 'headOffice',
            attributes: ['id', 'name', 'pincode']
          }] : [])
        ]
      }
    ],
    order: [[{ model: TourPlanDay, as: 'days' }, 'date', 'ASC']]
  });

  if (!plan) return null;

  const plain = plan.toJSON ? plan.toJSON() : plan;

  // Enrich each day
  if (plain.days && Array.isArray(plain.days)) {
    plain.days = plain.days.map(d => ({
      ...d,
      selected_asm: d.selectedAsm || d.coWorkWith || null,
      hq_name: d.headOffice ? d.headOffice.name : null
    }));
  }

  return plain;
};

const getRsmPlan = async (req, res) => {
  try {
    const models = getModels(req);
    if (!models || !models.TourPlan) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    const { TourPlan } = models;
    let plan = null;

    if (req.params.id) {
      plan = await getEnrichedRsmPlan(req.params.id, models);
    } else {
      const month = req.query.month || (new Date().getMonth() + 1);
      const year = req.query.year || new Date().getFullYear();
      let targetUserId = req.user.id;
      if (req.query.user_id && RSM_LEVEL_ROLES.includes(req.user.role)) {
        targetUserId = req.query.user_id;
      }

      const found = await TourPlan.findOne({
        where: {
          user_id: targetUserId,
          month: parseInt(month, 10),
          year: parseInt(year, 10)
        }
      });

      if (found) {
        plan = await getEnrichedRsmPlan(found.id, models);
      }
    }

    if (!plan) {
      return res.json({
        success: true,
        data: null,
        message: 'No RSM tour plan found for the requested criteria'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('getRsmPlan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getMyRsmPlans = async (req, res) => {
  try {
    const models = getModels(req);
    if (!models || !models.TourPlan) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    const { TourPlan } = models;
    const plans = await TourPlan.findAll({
      where: {
        user_id: req.user.id,
        plan_level: 'RSM'
      },
      order: [
        ['year', 'DESC'],
        ['month', 'DESC']
      ]
    });

    res.json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    console.error('getMyRsmPlans error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * ============================================================================
 * 6. SUBMIT RSM TOUR PLAN
 *
 * POST /api/tour-plans/rsm/submit
 * POST /api/tour-plans/rsm/:id/submit
 * ============================================================================
 */
const submitRsmTourPlan = async (req, res) => {
  try {
    const models = getModels(req);
    if (!models || !models.TourPlan) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    const { TourPlan } = models;
    const planId = req.params?.id || req.body?.plan_id || req.body?.id;
    let plan = null;

    if (planId) {
      plan = await TourPlan.findByPk(planId);
    } else {
      const month = req.body?.month;
      const year = req.body?.year;
      if (month && year) {
        plan = await TourPlan.findOne({
          where: {
            user_id: req.user.id,
            month: parseInt(month, 10),
            year: parseInt(year, 10)
          }
        });
      }
    }

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'RSM Tour Plan not found'
      });
    }

    if (plan.user_id !== req.user.id && !['Super Admin', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this plan'
      });
    }

    plan.status = 'Submitted';
    plan.plan_level = 'RSM';
    await plan.save();

    res.json({
      success: true,
      message: 'RSM Tour Plan submitted successfully for approval',
      data: {
        id: plan.id,
        status: plan.status,
        month: plan.month,
        year: plan.year
      }
    });
  } catch (error) {
    console.error('submitRsmTourPlan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * ============================================================================
 * 7. GET ASMS UNDER THIS RSM (CONVENIENCE HELPER)
 *
 * GET /api/tour-plans/rsm/asms
 * ============================================================================
 */
const getRsmAsms = async (req, res) => {
  try {
    const models = getModels(req);
    if (!models || !models.User) {
      return res.status(500).json({
        success: false,
        message: 'Required models are not available'
      });
    }

    const { User, HeadOffice, State, UserManager, UserHeadOffice } = models;

    // Target RSM
    let targetRsmId = req.user.id;
    if (req.query.rsm_id && RSM_LEVEL_ROLES.includes(req.user.role)) {
      targetRsmId = req.query.rsm_id;
    }

    const rsmUser = await User.findByPk(targetRsmId);
    if (!rsmUser) {
      return res.status(404).json({
        success: false,
        message: 'RSM user not found'
      });
    }

    const assignedHqIds = await getRsmAssignedHeadOfficeIds(rsmUser, models);

    const asms = await User.findAll({
      where: {
        is_active: true,
        [Op.or]: [
          { head_office_id: { [Op.in]: assignedHqIds }, role: { [Op.in]: ASM_LEVEL_ROLES } },
          { id: { [Op.ne]: rsmUser.id }, role: { [Op.in]: ASM_LEVEL_ROLES } }
        ]
      },
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'head_office_id'],
      include: [
        ...(HeadOffice ? [{ model: HeadOffice, attributes: ['id', 'name'] }] : [])
      ],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      count: asms.length,
      data: asms.map(a => {
        const plain = a.toJSON ? a.toJSON() : a;
        return {
          id: plain.id,
          name: plain.name,
          employee_code: plain.employee_code,
          email: plain.email,
          mobile_number: plain.mobile_number,
          role: plain.role,
          head_office_id: plain.head_office_id,
          head_office_name: plain.HeadOffice ? plain.HeadOffice.name : null
        };
      })
    });
  } catch (error) {
    console.error('getRsmAsms error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  ALL_VALID_ROLES,
  RSM_LEVEL_ROLES,
  ASM_LEVEL_ROLES,
  getRsmAssignedHeadOfficeIds,
  getRsmHierarchyOverview,
  getRsmUnassignedHqs,
  saveRsmTourPlanDraft,
  updateRsmPlanDay,
  getRsmPlan,
  getMyRsmPlans,
  submitRsmTourPlan,
  getRsmAsms
};
