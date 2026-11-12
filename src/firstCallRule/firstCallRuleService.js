// src/firstCallRule/firstCallRuleService.js
// Service for managing Flexible First Call Condition rules & backend compliance validation

const VALID_VISIT_TYPES = ['doctor', 'chemist', 'stockist'];

const DEFAULT_COMPANY_RULE = {
  id: null,
  scope: 'company',
  user_id: null,
  is_enabled: true,
  deadline_time: '10:30',
  allowed_visit_types: ['doctor', 'chemist', 'stockist'],
  min_qualifying_calls: 1,
  updated_by: null,
  updated_at: null
};

const initializedInstances = new WeakSet();

/**
 * Ensure first_call_rules table exists in PostgreSQL
 */
async function ensureFirstCallRulesTable(sequelize) {
  if (!sequelize || initializedInstances.has(sequelize)) return;

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS first_call_rules (
      id SERIAL PRIMARY KEY,
      scope VARCHAR(20) NOT NULL DEFAULT 'company',
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      deadline_time VARCHAR(10) NOT NULL DEFAULT '10:30',
      allowed_visit_types JSONB NOT NULL DEFAULT '["doctor","chemist","stockist"]'::jsonb,
      min_qualifying_calls INTEGER NOT NULL DEFAULT 1,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Ensure unique partial index for company rule & per-user override
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_first_call_rules_company_unique
    ON first_call_rules (scope) WHERE scope = 'company'
  `).catch(() => {});

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_first_call_rules_employee_unique
    ON first_call_rules (user_id) WHERE scope = 'employee' AND user_id IS NOT NULL
  `).catch(() => {});

  initializedInstances.add(sequelize);
}

/**
 * Format 24h "HH:mm" to 12h "hh:mm AM/PM"
 */
function formatTime12h(hhmm) {
  if (!hhmm || typeof hhmm !== 'string' || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) {
    return hhmm || '';
  }
  const [hStr, mStr] = hhmm.trim().split(':');
  let h = parseInt(hStr, 10);
  const m = mStr.padStart(2, '0');
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}

/**
 * Extract IST date ("YYYY-MM-DD"), 24h time ("HH:mm"), and 12h formatted time ("hh:mm AM/PM")
 */
function getISTParts(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);

  // Some Node locales return "24:00" for midnight in en-GB hour12:false
  const normalizedHHmm = timeParts.startsWith('24:') ? `00:${timeParts.slice(3)}` : timeParts;

  return {
    dateStr,
    timeHHmm: normalizedHHmm,
    formatted12h: formatTime12h(normalizedHHmm)
  };
}

/**
 * Normalize a DB row into a clean rule object
 */
function normalizeRuleRow(row) {
  if (!row) return null;
  let allowedTypes = row.allowed_visit_types;
  if (typeof allowedTypes === 'string') {
    try {
      allowedTypes = JSON.parse(allowedTypes);
    } catch {
      allowedTypes = ['doctor', 'chemist', 'stockist'];
    }
  }
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) {
    allowedTypes = ['doctor', 'chemist', 'stockist'];
  }

  return {
    id: row.id,
    scope: row.scope || 'company',
    user_id: row.user_id || null,
    user_name: row.user_name || null,
    employee_code: row.employee_code || null,
    user_role: row.user_role || null,
    is_enabled: Boolean(row.is_enabled),
    deadline_time: row.deadline_time || '10:30',
    deadline_formatted: formatTime12h(row.deadline_time || '10:30'),
    allowed_visit_types: allowedTypes.map((t) => String(t).toLowerCase()).filter((t) => VALID_VISIT_TYPES.includes(t)),
    min_qualifying_calls: Math.max(1, parseInt(row.min_qualifying_calls, 10) || 1),
    updated_by: row.updated_by || null,
    updated_by_name: row.updated_by_name || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

/**
 * Fetch active company-wide rule and all employee-specific overrides
 */
async function getActiveRules(sequelize) {
  await ensureFirstCallRulesTable(sequelize);

  const rows = await sequelize.query(
    `SELECT fcr.*,
            u.name AS user_name,
            u.employee_code AS employee_code,
            u.role AS user_role,
            upd.name AS updated_by_name
     FROM first_call_rules fcr
     LEFT JOIN users u ON fcr.user_id = u.id
     LEFT JOIN users upd ON fcr.updated_by = upd.id
     ORDER BY fcr.scope ASC, fcr.updated_at DESC`,
    { type: sequelize.QueryTypes.SELECT }
  );

  let companyRule = { ...DEFAULT_COMPANY_RULE, deadline_formatted: formatTime12h(DEFAULT_COMPANY_RULE.deadline_time) };
  const employeeOverridesList = [];
  const employeeOverridesMap = new Map();

  for (const row of rows) {
    const normalized = normalizeRuleRow(row);
    if (!normalized) continue;
    if (normalized.scope === 'company') {
      companyRule = normalized;
    } else if (normalized.scope === 'employee' && normalized.user_id) {
      employeeOverridesList.push(normalized);
      employeeOverridesMap.set(String(normalized.user_id), normalized);
    }
  }

  return {
    companyRule,
    employeeOverridesList,
    employeeOverridesMap
  };
}

/**
 * Resolve effective rule for a specific employee (employee override takes precedence over company rule)
 */
function resolveRuleForUser(userId, activeRules) {
  if (!activeRules) {
    return { ...DEFAULT_COMPANY_RULE, deadline_formatted: formatTime12h(DEFAULT_COMPANY_RULE.deadline_time) };
  }
  if (userId && activeRules.employeeOverridesMap?.has(String(userId))) {
    return activeRules.employeeOverridesMap.get(String(userId));
  }
  return activeRules.companyRule;
}

/**
 * Backend validation: Evaluate employee compliance for a target date against their effective rule
 *
 * @param {Object} params
 * @param {Object} params.rule Effective rule (company or employee override)
 * @param {Array} params.visits Employee visits (DoctorVisit, ChemistVisit, StockistVisit combined)
 * @param {string} params.targetDate YYYY-MM-DD in IST
 * @param {Date} [params.now] Reference timestamp (defaults to current time)
 */
function evaluateFirstCallCompliance({ rule, visits = [], targetDate, now = new Date() }) {
  const effectiveRule = rule || DEFAULT_COMPANY_RULE;

  if (!effectiveRule.is_enabled) {
    return {
      enabled: false,
      rule_scope: effectiveRule.scope || 'company',
      deadline_time: effectiveRule.deadline_time,
      deadline_formatted: formatTime12h(effectiveRule.deadline_time),
      allowed_visit_types: effectiveRule.allowed_visit_types,
      min_qualifying_calls: effectiveRule.min_qualifying_calls,
      qualifying_calls_before_deadline: 0,
      total_qualifying_calls: 0,
      first_qualifying_call_time: null,
      first_qualifying_call_type: null,
      status: 'disabled'
    };
  }

  const allowedSet = new Set(
    (effectiveRule.allowed_visit_types || VALID_VISIT_TYPES).map((t) => String(t).toLowerCase())
  );
  const deadlineHHmm = effectiveRule.deadline_time || '10:30';
  const minCalls = Math.max(1, parseInt(effectiveRule.min_qualifying_calls, 10) || 1);

  // Filter confirmed qualifying visits on targetDate
  const qualifyingVisits = [];
  for (const v of visits) {
    const isConfirmed = Boolean(v.confirmed || v.visit_confirmed);
    if (!isConfirmed) continue;

    const vType = String(v.visit_type || '').toLowerCase();
    if (!allowedSet.has(vType)) continue;

    // Determine timestamp in IST
    const rawTimestamp = v.created_at || v.createdAt || v.updated_at || v.updatedAt;
    const istParts = rawTimestamp ? getISTParts(rawTimestamp) : null;

    // Match targetDate against v.date (if provided) or IST date of created_at
    const visitDateStr = v.date ? String(v.date).slice(0, 10) : istParts?.dateStr;
    if (targetDate && visitDateStr !== targetDate) continue;

    if (!istParts) continue;

    qualifyingVisits.push({
      visit_type: vType,
      timeHHmm: istParts.timeHHmm,
      formatted12h: istParts.formatted12h,
      timestampMs: new Date(rawTimestamp).getTime()
    });
  }

  // Sort chronologically (earliest first)
  qualifyingVisits.sort((a, b) => a.timestampMs - b.timestampMs);

  const callsBeforeDeadline = qualifyingVisits.filter((v) => v.timeHHmm <= deadlineHHmm);
  const firstCall = qualifyingVisits.length > 0 ? qualifyingVisits[0] : null;

  let status = 'pending';
  if (callsBeforeDeadline.length >= minCalls) {
    status = 'satisfied';
  } else {
    const nowIST = getISTParts(now);
    if (targetDate && nowIST) {
      if (targetDate < nowIST.dateStr) {
        status = 'failed';
      } else if (targetDate === nowIST.dateStr && nowIST.timeHHmm > deadlineHHmm) {
        status = 'failed';
      } else {
        status = 'pending';
      }
    }
  }

  return {
    enabled: true,
    rule_scope: effectiveRule.scope || 'company',
    deadline_time: deadlineHHmm,
    deadline_formatted: formatTime12h(deadlineHHmm),
    allowed_visit_types: Array.from(allowedSet),
    min_qualifying_calls: minCalls,
    qualifying_calls_before_deadline: callsBeforeDeadline.length,
    total_qualifying_calls: qualifyingVisits.length,
    first_qualifying_call_time: firstCall ? firstCall.formatted12h : null,
    first_qualifying_call_time_24h: firstCall ? firstCall.timeHHmm : null,
    first_qualifying_call_type: firstCall ? firstCall.visit_type : null,
    status
  };
}

module.exports = {
  VALID_VISIT_TYPES,
  DEFAULT_COMPANY_RULE,
  ensureFirstCallRulesTable,
  formatTime12h,
  getISTParts,
  getActiveRules,
  resolveRuleForUser,
  evaluateFirstCallCompliance
};

