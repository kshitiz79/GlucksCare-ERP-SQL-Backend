// src/firstCallRule/firstCallRuleRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getFirstCallRules,
  saveFirstCallRule,
  deleteEmployeeOverride,
  getFirstCallRuleAuditLogs,
  evaluateEmployeeFirstCall
} = require('./firstCallRuleController');

router.use(authMiddleware);

router.get('/', getFirstCallRules);
router.post('/', saveFirstCallRule);
router.delete('/override/:userId', deleteEmployeeOverride);
router.get('/audit-logs', getFirstCallRuleAuditLogs);
router.get('/evaluate', evaluateEmployeeFirstCall);

module.exports = router;

