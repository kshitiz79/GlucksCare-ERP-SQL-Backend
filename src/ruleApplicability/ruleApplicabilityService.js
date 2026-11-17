// src/ruleApplicability/ruleApplicabilityService.js
// Enterprise Rule Applicability Engine: Decoupled filter builder, evaluator & live preview

const { Op } = require('sequelize');

class RuleApplicabilityService {
  /**
   * Fetch all dynamic filter options from database
   */
  static async getFieldOptions(models) {
    const { Designation, HeadOffice, State, Department, User, Branch } = models;

    const [
      designations,
      headOffices,
      states,
      departments,
      branches,
      rawUsers
    ] = await Promise.all([
      Designation ? Designation.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }).catch(() => []) : [],
      HeadOffice ? HeadOffice.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }).catch(() => []) : [],
      State ? State.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }).catch(() => []) : [],
      Department ? Department.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }).catch(() => []) : [],
      Branch ? Branch.findAll({ where: { is_active: true }, order: [['name', 'ASC']] }).catch(() => []) : [],
      User.findAll({
        where: { is_active: true },
        attributes: ['id', 'name', 'employee_code', 'role', 'is_active', 'designation_id', 'head_office_id', 'state_id'],
        include: [
          Designation ? { model: Designation, as: 'designation', attributes: ['id', 'name'] } : null,
          HeadOffice ? { model: HeadOffice, as: 'headOffices', attributes: ['id', 'name'], through: { attributes: [] } } : null
        ].filter(Boolean),
        order: [['name', 'ASC']]
      }).catch(() => [])
    ]);

    // Format managers (Active users with leadership roles or referenced as superiors)
    const activeUsers = rawUsers.filter(u => u.is_active !== false);
    const managerRoles = ['Manager', 'Area Manager', 'Zonal Manager', 'State Head', 'National Head', 'Admin', 'Super Admin'];
    const managers = activeUsers
      .filter(u => managerRoles.includes(u.role))
      .map(u => ({
        id: u.id,
        name: u.name,
        employeeCode: u.employee_code,
        role: u.role,
        designationName: u.designation?.name || u.role
      }));

    // Format active employees for individual selector and exclusion
    const employees = activeUsers.map(u => {
      const hoName = (u.headOffices && u.headOffices.length > 0)
        ? u.headOffices.map(h => h.name).join(', ')
        : 'N/A';
      return {
        id: u.id,
        name: u.name,
        employeeCode: u.employee_code,
        role: u.role,
        designationName: u.designation?.name || u.role,
        headOfficeName: hoName,
        isActive: u.is_active
      };
    });

    return {
      designations: designations.map(d => ({ id: d.id, name: d.name, code: d.code || '' })),
      headOffices: headOffices.map(h => ({ id: h.id, name: h.name, stateId: h.state_id })),
      states: states.map(s => ({ id: s.id, name: s.name, code: s.code })),
      departments: departments.map(dp => ({ id: dp.id, name: dp.name })),
      branches: branches.map(b => ({ id: b.id, name: b.name })),
      managers,
      employees,
      employmentStatuses: [
        { id: 'Active', name: 'Active' },
        { id: 'Inactive', name: 'Inactive' }
      ]
    };
  }

  /**
   * Safely evaluate a filter configuration and return live preview stats & employee list
   */
  static async previewFilter(models, filterConfig = {}) {
    const {
      apply_mode = 'all', // 'all' | 'designation' | 'specific' | 'advanced'
      designations = [],
      specific_employee_ids = [],
      filter_conditions = { logic: 'AND', conditions: [] },
      exclude = { mode: 'employees', employee_ids: [], designations: [] }
    } = filterConfig;

    const { User, Designation, HeadOffice, UserManager, UserHeadOffice } = models;

    // Fetch candidate active users with associations
    const candidateUsers = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'employee_code', 'role', 'is_active', 'designation_id', 'head_office_id', 'state_id', 'department_id', 'branch_id'],
      include: [
        Designation ? { model: Designation, as: 'designation', attributes: ['id', 'name'] } : null,
        HeadOffice ? { model: HeadOffice, as: 'headOffices', attributes: ['id', 'name'], through: { attributes: [] } } : null
      ].filter(Boolean),
      order: [['name', 'ASC']]
    });

    // Pre-fetch junction maps for hierarchy & multi-head office evaluation
    let userManagerMap = new Map(); // user_id -> Set of manager_ids
    let userHeadOfficeMap = new Map(); // user_id -> Set of head_office_ids

    if (UserManager) {
      const userManagers = await UserManager.findAll({ attributes: ['user_id', 'manager_id'] }).catch(() => []);
      userManagers.forEach(um => {
        if (!userManagerMap.has(um.user_id)) userManagerMap.set(um.user_id, new Set());
        userManagerMap.get(um.user_id).add(um.manager_id);
      });
    }

    if (UserHeadOffice) {
      const userHos = await UserHeadOffice.findAll({ attributes: ['user_id', 'head_office_id'] }).catch(() => []);
      userHos.forEach(uho => {
        if (!userHeadOfficeMap.has(uho.user_id)) userHeadOfficeMap.set(uho.user_id, new Set());
        userHeadOfficeMap.get(uho.user_id).add(uho.head_office_id);
      });
    }

    // Step 1: Evaluate Inclusion based on apply_mode
    let matchedUsers = [];

    if (apply_mode === 'all') {
      matchedUsers = candidateUsers;
    } else if (apply_mode === 'designation') {
      const targetDesigSet = new Set((designations || []).map(String));
      matchedUsers = candidateUsers.filter(u => {
        const desigId = u.designation_id ? String(u.designation_id) : null;
        const desigName = u.designation?.name || u.role;
        return (desigId && targetDesigSet.has(desigId)) || targetDesigSet.has(desigName) || targetDesigSet.has(u.role);
      });
    } else if (apply_mode === 'specific') {
      const targetIdSet = new Set((specific_employee_ids || []).map(String));
      matchedUsers = candidateUsers.filter(u => targetIdSet.has(String(u.id)));
    } else if (apply_mode === 'advanced') {
      const { logic = 'AND', conditions = [] } = filter_conditions;

      if (!Array.isArray(conditions) || conditions.length === 0) {
        matchedUsers = candidateUsers;
      } else {
        matchedUsers = candidateUsers.filter(user => {
          const results = conditions.map(cond => {
            return this._evaluateSingleCondition(cond, user, userManagerMap, userHeadOfficeMap);
          });

          return logic.toUpperCase() === 'OR'
            ? results.some(Boolean)
            : results.every(Boolean);
        });
      }
    }

    const totalMatchedCount = matchedUsers.length;

    // Step 2: Apply Exclusions (Strict Priority: Exclusion ALWAYS overrides inclusion)
    let excludedSet = new Set();
    const excludeEmployeeIds = Array.isArray(exclude?.employee_ids) ? exclude.employee_ids.map(String) : [];
    const excludeDesignationIds = Array.isArray(exclude?.designations) ? exclude.designations.map(String) : [];

    matchedUsers.forEach(u => {
      const uid = String(u.id);
      const desigId = u.designation_id ? String(u.designation_id) : '';
      const desigName = u.designation?.name || u.role;

      if (exclude?.mode === 'designations' || excludeDesignationIds.length > 0) {
        if (excludeDesignationIds.includes(desigId) || excludeDesignationIds.includes(desigName) || excludeDesignationIds.includes(u.role)) {
          excludedSet.add(uid);
        }
      }
      if (excludeEmployeeIds.includes(uid)) {
        excludedSet.add(uid);
      }
    });

    const finalApplicableUsers = matchedUsers.filter(u => !excludedSet.has(String(u.id)));

    // Step 3: Compute designation breakdown (e.g. MR: 15 | ASM: 3)
    const breakdown = {};
    finalApplicableUsers.forEach(u => {
      // Prefer friendly acronym or designation name
      let label = u.designation?.name || u.role;
      if (label.includes('Medical Representative') || label === 'User') label = 'MR';
      else if (label.includes('Area Manager') || label === 'Area Manager') label = 'ASM';
      else if (label.includes('Zonal Manager')) label = 'ZM';
      else if (label.includes('State Head')) label = 'State Head';
      else if (label.includes('Manager')) label = 'Manager';

      breakdown[label] = (breakdown[label] || 0) + 1;
    });

    // Sample payload for View Employees modal
    const sampleEmployees = finalApplicableUsers.map(u => ({
      id: u.id,
      name: u.name,
      employeeCode: u.employee_code,
      role: u.role,
      designationName: u.designation?.name || u.role,
      headOfficeName: (u.headOffices && u.headOffices.length > 0) ? u.headOffices.map(h => h.name).join(', ') : 'N/A',
      isActive: u.is_active
    }));

    return {
      success: true,
      totalMatched: totalMatchedCount,
      excludedCount: excludedSet.size,
      finalApplicableCount: finalApplicableUsers.length,
      breakdown,
      employees: sampleEmployees
    };
  }

  /**
   * Evaluate a single condition against a user record
   */
  static _evaluateSingleCondition(cond, user, userManagerMap, userHeadOfficeMap) {
    const { field, operator = 'in', values = [] } = cond;
    if (!field) return true;

    const normValues = Array.isArray(values) ? values.map(v => typeof v === 'object' && v !== null ? String(v.id || v.name) : String(v)) : [String(values)];
    if (normValues.length === 0) return true;

    const op = (operator || '').toLowerCase();
    const isNegation = op === 'not in' || op === '!=' || op === 'not_in';

    let isMatch = false;

    switch (field) {
      case 'designation': {
        const uDesigId = user.designation_id ? String(user.designation_id) : '';
        const uDesigName = (user.designation?.name || user.role || '').toLowerCase();
        isMatch = normValues.some(v => {
          const lowV = v.toLowerCase();
          return v === uDesigId || lowV === uDesigName || lowV === (user.role || '').toLowerCase();
        });
        break;
      }

      case 'hq':
      case 'head_office':
      case 'territory': {
        const primaryHoId = user.head_office_id ? String(user.head_office_id) : '';
        const multiHos = userHeadOfficeMap.get(user.id) || new Set();
        isMatch = normValues.some(v => {
          return v === primaryHoId || multiHos.has(v);
        });
        break;
      }

      case 'reporting_manager':
      case 'manager': {
        const managers = userManagerMap.get(user.id) || new Set();
        isMatch = normValues.some(mId => managers.has(mId));
        break;
      }

      case 'employment_status':
      case 'status': {
        const userStatus = user.is_active ? 'active' : 'inactive';
        isMatch = normValues.some(v => v.toLowerCase() === userStatus);
        break;
      }

      case 'state': {
        const stateId = user.state_id ? String(user.state_id) : '';
        isMatch = normValues.includes(stateId);
        break;
      }

      case 'department': {
        const deptId = user.department_id ? String(user.department_id) : '';
        isMatch = normValues.includes(deptId);
        break;
      }

      case 'employee': {
        isMatch = normValues.includes(String(user.id));
        break;
      }

      default:
        isMatch = true;
    }

    return isNegation ? !isMatch : isMatch;
  }

  /**
   * Evaluate if a specific user qualifies for an active rule
   */
  static async isUserApplicable(models, userId, applicabilityConfig) {
    if (!applicabilityConfig || applicabilityConfig.apply_mode === 'all') {
      // Check exclusion
      const excludeIds = applicabilityConfig?.exclude?.employee_ids || [];
      return !excludeIds.map(String).includes(String(userId));
    }

    // If fixed snapshot mode, check if userId exists in snapshot
    if (applicabilityConfig.is_dynamic === false && Array.isArray(applicabilityConfig.snapshot_employee_ids)) {
      return applicabilityConfig.snapshot_employee_ids.map(String).includes(String(userId));
    }

    // Dynamic evaluation
    const preview = await this.previewFilter(models, applicabilityConfig);
    return preview.employees.some(e => String(e.id) === String(userId));
  }
}

module.exports = RuleApplicabilityService;

