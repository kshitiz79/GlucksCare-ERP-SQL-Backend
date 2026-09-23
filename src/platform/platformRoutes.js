// src/platform/platformRoutes.js
// Routes for Platform Super Admin operations

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const platformController = require('./platformController');

const JWT_SECRET = process.env.JWT_SECRET || 'gluckscare_platform_master_secret_2026';

// Super Admin Auth Middleware
function platformAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Platform authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required' });
    }
    req.platformAdmin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired platform token' });
  }
}

// Public Auth & App Configuration Endpoints
router.post('/auth/login', platformController.login);
router.get('/companies/public', platformController.getPublicCompanies);
router.get('/company-config/:identifier', platformController.getCompanyConfig);
router.get('/company-config', platformController.getCompanyConfig);

// Platform Management Endpoints
router.get('/tenants', platformController.getTenants);
router.post('/tenants', platformController.createTenant);
router.put('/tenants/:id', platformController.updateTenant);
router.patch('/tenants/:id', platformController.updateTenant);
router.patch('/tenants/:id/status', platformController.toggleTenantStatus);
router.delete('/tenants/:id', platformController.deleteTenant);

module.exports = router;
