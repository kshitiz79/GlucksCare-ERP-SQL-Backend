// src/firstCallRule/firstCallRuleController.js
const { Op } = require('sequelize');
const UserActivityLogService = require('../userActivityLog/userActivityLogService');
const {
  VALID_VISIT_TYPES,
  ensureFirstCallRulesTable,
  getActiveRules,
  resolveRuleForUser,
  evaluateFirstCallCompliance,
  getISTParts
} = require('./firstCallRuleService');

/**
 * Normalize and validate rule payload
 */
function validateRulePayload(body) {
  const {
    scope = 'company',
    is_enabled = true,
    deadline_time = '10:30',
    allowed_visit_types = ['doctor', 'chemist', 'stockist'],
    min_qualifying_calls = 1
  } = body;

  if (!['company', 'employee'].includes(scope)) {
    return { error: 'Invalid scope. Must be "company" or "employee".' };
  }

  const trimmedTime = String(deadline_time || '').trim();
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmedTime)) {
    return { error: 'Invalid deadline_time. Expected 24-hour HH:mm format (e.g. 10:30).' };
  }
  const [hh, mm] = trimmedTime.split(':');
  const normalizedTime = `${hh.padStart(2, '0')}:${mm}`;

  if (!Array.isArray(allowed_visit_types) || allowed_visit_types.length === 0) {
    return { error: 'Please select at least one qualifying visit type (Doctor, Chemist, or Stockist).' };
  }
  const normalizedTypes = Array.from(
    new Set(
      allowed_visit_types
        .map((t) => String(t).toLowerCase().trim())
        .filter((t) => VALID_VISIT_TYPES.includes(t))
    )
  );
  if (normalizedTypes.length === 0) {
    return { error: 'allowed_visit_types must include at least one of: doctor, chemist, stockist.' };
  }

  const minCalls = parseInt(min_qualifying_calls, 10);
  if (isNaN(minCalls) || minCalls < 1 || minCalls > 50) {
    return { error: 'min_qualifying_calls must be a whole number between 1 and 50.' };
  }

  return {
    scope,
    is_enabled: Boolean(is_enabled),
    deadline_time: normalizedTime,
    allowed_visit_types: normalizedTypes,
    min_qualifying_calls: minCalls
  };
}

/**
 * GET /api/first-call-rules
 * Returns company-wide rule + all employee-specific overrides
 */
const getFirstCallRules = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');
    const rules = await getActiveRules(sequelize);

    return res.json({
      success: true,
      data: {
        companyRule: rules.companyRule,
        employeeOverrides: rules.employeeOverridesList
      }
    });
  } catch (error) {
    console.error('getFirstCallRules error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/first-call-rules
 * Save or update company-wide rule or employee-specific override(s), with audit logging
 */
const saveFirstCallRule = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');
    await ensureFirstCallRulesTable(sequelize);

    const validated = validateRulePayload(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const adminUserId = req.user?.id || null;
    const typesJson = JSON.stringify(validated.allowed_visit_types);
    const previousRules = await getActiveRules(sequelize);

    if (validated.scope === 'company') {
      const existing = await sequelize.query(
        `SELECT id FROM first_call_rules WHERE scope = 'company' LIMIT 1`,
        { type: sequelize.QueryTypes.SELECT }
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE first_call_rules
           SET is_enabled = :is_enabled,
               deadline_time = :deadline_time,
               allowed_visit_types = :typesJson::jsonb,
               min_qualifying_calls = :min_qualifying_calls,
               updated_by = :adminUserId,
               updated_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              is_enabled: validated.is_enabled,
              deadline_time: validated.deadline_time,
              typesJson,
              min_qualifying_calls: validated.min_qualifying_calls,
              adminUserId
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      } else {
        await sequelize.query(
          `INSERT INTO first_call_rules
            (scope, user_id, is_enabled, deadline_time, allowed_visit_types, min_qualifying_calls, updated_by, created_at, updated_at)
           VALUES ('company', NULL, :is_enabled, :deadline_time, :typesJson::jsonb, :min_qualifying_calls, :adminUserId, NOW(), NOW())`,
          {
            replacements: {
              is_enabled: validated.is_enabled,
              deadline_time: validated.deadline_time,
              typesJson,
              min_qualifying_calls: validated.min_qualifying_calls,
              adminUserId
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
      }

      // Audit Log
      await UserActivityLogService.logActivity(req, {
        userId: adminUserId,
        email: req.user?.email || null,
        action: 'UPDATE_FIRST_CALL_RULE',
        details: {
          scope: 'company',
          previous: {
            is_enabled: previousRules.companyRule.is_enabled,
            deadline_time: previousRules.companyRule.deadline_time,
            allowed_visit_types: previousRules.companyRule.allowed_visit_types,
            min_qualifying_calls: previousRules.companyRule.min_qualifying_calls
          },
          updated: {
            is_enabled: validated.is_enabled,
            deadline_time: validated.deadline_time,
            allowed_visit_types: validated.allowed_visit_types,
            min_qualifying_calls: validated.min_qualifying_calls
          }
        }
      });
    } else {
      // Employee-specific override(s)
      const targetIds = Array.isArray(req.body.user_ids) && req.body.user_ids.length > 0
        ? req.body.user_ids
        : (req.body.user_id ? [req.body.user_id] : []);

      const cleanIds = Array.from(new Set(targetIds.filter(Boolean).map(String)));
      if (cleanIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one employee for an employee-specific rule override.'
        });
      }

      for (const uid of cleanIds) {
        const prevOverride = previousRules.employeeOverridesMap.get(uid) || null;
        const existing = await sequelize.query(
          `SELECT id FROM first_call_rules WHERE scope = 'employee' AND user_id = :uid LIMIT 1`,
          { replacements: { uid }, type: sequelize.QueryTypes.SELECT }
        );

        if (existing.length > 0) {
          await sequelize.query(
            `UPDATE first_call_rules
             SET is_enabled = :is_enabled,
                 deadline_time = :deadline_time,
                 allowed_visit_types = :typesJson::jsonb,
                 min_qualifying_calls = :min_qualifying_calls,
                 updated_by = :adminUserId,
                 updated_at = NOW()
             WHERE id = :id`,
            {
              replacements: {
                id: existing[0].id,
                is_enabled: validated.is_enabled,
                deadline_time: validated.deadline_time,
                typesJson,
                min_qualifying_calls: validated.min_qualifying_calls,
                adminUserId
              },
              type: sequelize.QueryTypes.UPDATE
            }
          );
        } else {
          await sequelize.query(
            `INSERT INTO first_call_rules
              (scope, user_id, is_enabled, deadline_time, allowed_visit_types, min_qualifying_calls, updated_by, created_at, updated_at)
             VALUES ('employee', :uid, :is_enabled, :deadline_time, :typesJson::jsonb, :min_qualifying_calls, :adminUserId, NOW(), NOW())`,
            {
              replacements: {
                uid,
                is_enabled: validated.is_enabled,
                deadline_time: validated.deadline_time,
                typesJson,
                min_qualifying_calls: validated.min_qualifying_calls,
                adminUserId
              },
              type: sequelize.QueryTypes.INSERT
            }
          );
        }

        await UserActivityLogService.logActivity(req, {
          userId: adminUserId,
          email: req.user?.email || null,
          action: 'UPDATE_FIRST_CALL_RULE',
          details: {
            scope: 'employee',
            target_user_id: uid,
            previous: prevOverride
              ? {
                  is_enabled: prevOverride.is_enabled,
                  deadline_time: prevOverride.deadline_time,
                  allowed_visit_types: prevOverride.allowed_visit_types,
                  min_qualifying_calls: prevOverride.min_qualifying_calls
                }
              : null,
            updated: {
              is_enabled: validated.is_enabled,
              deadline_time: validated.deadline_time,
              allowed_visit_types: validated.allowed_visit_types,
              min_qualifying_calls: validated.min_qualifying_calls
            }
          }
        });
      }
    }

    const updatedRules = await getActiveRules(sequelize);
    return res.json({
      success: true,
      message:
        validated.scope === 'company'
          ? 'Company-wide First Call Condition saved successfully'
          : 'Employee-specific First Call Condition override saved successfully',
      data: {
        companyRule: updatedRules.companyRule,
        employeeOverrides: updatedRules.employeeOverridesList
      }
    });
  } catch (error) {
    console.error('saveFirstCallRule error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/first-call-rules/override/:userId
 * Remove an employee-specific override so they revert to company-wide rule
 */
const deleteEmployeeOverride = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');
    await ensureFirstCallRulesTable(sequelize);
    const { userId } = req.params;
    const adminUserId = req.user?.id || null;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const existing = await sequelize.query(
      `SELECT fcr.*, u.name AS user_name
       FROM first_call_rules fcr
       LEFT JOIN users u ON fcr.user_id = u.id
       WHERE fcr.scope = 'employee' AND fcr.user_id = :userId
       LIMIT 1`,
      { replacements: { userId }, type: sequelize.QueryTypes.SELECT }
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee override not found' });
    }

    await sequelize.query(
      `DELETE FROM first_call_rules WHERE scope = 'employee' AND user_id = :userId`,
      { replacements: { userId }, type: sequelize.QueryTypes.DELETE }
    );

    await UserActivityLogService.logActivity(req, {
      userId: adminUserId,
      email: req.user?.email || null,
      action: 'DELETE_FIRST_CALL_RULE_OVERRIDE',
      details: {
        scope: 'employee',
        target_user_id: userId,
        target_user_name: existing[0].user_name || null,
        removed_rule: {
          is_enabled: existing[0].is_enabled,
          deadline_time: existing[0].deadline_time,
          allowed_visit_types: existing[0].allowed_visit_types,
          min_qualifying_calls: existing[0].min_qualifying_calls
        }
      }
    });

    const updatedRules = await getActiveRules(sequelize);
    return res.json({
      success: true,
      message: 'Employee override removed; reverted to company-wide rule.',
      data: {
        companyRule: updatedRules.companyRule,
        employeeOverrides: updatedRules.employeeOverridesList
      }
    });
  } catch (error) {
    console.error('deleteEmployeeOverride error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/first-call-rules/audit-logs
 * Fetch audit logs for First Call Condition changes
 */
const getFirstCallRuleAuditLogs = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');

    const rows = await sequelize.query(
      `SELECT ual.id, ual.user_id, ual.email, ual.action, ual.details, ual.ip_address, ual.created_at,
              u.name AS actor_name, u.role AS actor_role
       FROM user_activity_logs ual
       LEFT JOIN users u ON ual.user_id = u.id
       WHERE ual.action IN ('UPDATE_FIRST_CALL_RULE', 'DELETE_FIRST_CALL_RULE_OVERRIDE')
       ORDER BY ual.created_at DESC
       LIMIT 50`,
      { type: sequelize.QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getFirstCallRuleAuditLogs error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/first-call-rules/evaluate
 * Backend validation endpoint for a given user (or current user) and date (defaults to today IST)
 */
const evaluateEmployeeFirstCall = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    const { DoctorVisit, ChemistVisit, StockistVisit } = models;

    const targetUserId = req.query.user_id || req.user?.id;
    const nowIST = getISTParts(new Date());
    const targetDate = req.query.date || nowIST.dateStr;

    const [activeRules, docVisits, chemVisits, stockVisits] = await Promise.all([
      getActiveRules(sequelize),
      DoctorVisit.findAll({
        where: { user_id: targetUserId, date: targetDate },
        attributes: ['id', 'user_id', 'date', 'confirmed', 'created_at', 'updated_at']
      }),
      ChemistVisit.findAll({
        where: { user_id: targetUserId, date: targetDate },
        attributes: ['id', 'user_id', 'date', 'confirmed', 'created_at', 'updated_at']
      }),
      StockistVisit.findAll({
        where: { user_id: targetUserId, date: targetDate },
        attributes: ['id', 'user_id', 'date', 'confirmed', 'created_at', 'updated_at']
      })
    ]);

    const combinedVisits = [
      ...docVisits.map((v) => ({ visit_type: 'doctor', ...v.toJSON() })),
      ...chemVisits.map((v) => ({ visit_type: 'chemist', ...v.toJSON() })),
      ...stockVisits.map((v) => ({ visit_type: 'stockist', ...v.toJSON() }))
    ];

    const effectiveRule = resolveRuleForUser(targetUserId, activeRules);
    const evaluation = evaluateFirstCallCompliance({
      rule: effectiveRule,
      visits: combinedVisits,
      targetDate
    });

    return res.json({
      success: true,
      data: {
        user_id: targetUserId,
        date: targetDate,
        ...evaluation
      }
    });
  } catch (error) {
    console.error('evaluateEmployeeFirstCall error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getFirstCallRules,
  saveFirstCallRule,
  deleteEmployeeOverride,
  getFirstCallRuleAuditLogs,
  evaluateEmployeeFirstCall
};

