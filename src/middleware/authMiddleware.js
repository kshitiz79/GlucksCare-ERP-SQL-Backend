// src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const { User } = require('../config/database');

const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        
        // Check if Authorization header exists
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                msg: 'No authorization header found' 
            });
        }

        // Check if it's a Bearer token
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                msg: 'Invalid authorization header format' 
            });
        }

        // Extract token
        const token = authHeader.replace('Bearer ', '');

        // Check if token exists and is not empty
        if (!token || token.trim() === '') {
            return res.status(401).json({ 
                success: false,
                msg: 'No token provided' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let userModel = User;
        if (decoded.tenant && decoded.tenant.db_name) {
            const { getTenantDb } = require('../platform/tenantConnectionManager');
            const tenantDb = getTenantDb(decoded.tenant.db_name);
            userModel = tenantDb.models.User;
            req.tenant = decoded.tenant;
            req.db = tenantDb.models;
            req.tenantSequelize = tenantDb.sequelize;

            // Dynamically scope req.app.get('models') and req.app.get('sequelize') to this tenant's isolated DB
            const originalApp = req.app;
            if (originalApp) {
                const tenantApp = Object.create(originalApp);
                tenantApp.get = function(name) {
                    if (name === 'models') return tenantDb.models;
                    if (name === 'sequelize') return tenantDb.sequelize;
                    return originalApp.get.call(originalApp, name);
                };
                req.app = tenantApp;
            }
        }

        // Get user from database
        const user = await userModel.findByPk(decoded.id, {
            attributes: { exclude: ['password', 'password_hash'] }
        });

        if (!user) {
            return res.status(401).json({ 
                success: false,
                msg: 'Token is not valid - user not found' 
            });
        }

        // Check if token was issued before forced logout timestamp (tokens_valid_after)
        if (user.tokens_valid_after && decoded.iat) {
            const tokenIatMs = decoded.iat * 1000;
            const validAfterMs = new Date(user.tokens_valid_after).getTime();
            if (tokenIatMs < validAfterMs) {
                return res.status(401).json({ 
                    success: false,
                    msg: 'Session has expired - forced logout by admin' 
                });
            }
        }

        // NOTE: Temporarily bypassing active status check for testing
        // if (!user.isActive) {
        //     return res.status(401).json({ 
        //         success: false,
        //         msg: 'User account is deactivated' 
        //     });
        // }

        // Add user to request object
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.name, error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                msg: 'Token is not valid - malformed token' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                msg: 'Token has expired' 
            });
        }

        res.status(500).json({ 
            success: false,
            msg: 'Server error in authentication' 
        });
    }
};

// Role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                msg: 'Access denied - no user found' 
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false,
                msg: `Access denied - requires one of: ${roles.join(', ')}` 
            });
        }

        next();
    };
};

// Admin authorization (Super Admin, Admin)
const adminAuth = authorize('Super Admin', 'Admin');

// Manager authorization (includes Admin + Manager roles)
const managerAuth = authorize('Super Admin', 'Admin', 'National Head', 'State Head', 'Zonal Manager', 'Area Manager', 'Manager');

// Optional auth middleware (attaches tenant context if token is present, does not fail if absent)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) return next();

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.tenant && decoded.tenant.db_name) {
            const { getTenantDb } = require('../platform/tenantConnectionManager');
            const tenantDb = getTenantDb(decoded.tenant.db_name);
            req.tenant = decoded.tenant;
            req.db = tenantDb.models;
            req.tenantSequelize = tenantDb.sequelize;

            const originalApp = req.app;
            if (originalApp) {
                const tenantApp = Object.create(originalApp);
                tenantApp.get = function(name) {
                    if (name === 'models') return tenantDb.models;
                    if (name === 'sequelize') return tenantDb.sequelize;
                    return originalApp.get.call(originalApp, name);
                };
                req.app = tenantApp;
            }
        }
        next();
    } catch (e) {
        next();
    }
};

module.exports = {
    authMiddleware,
    authorize,
    adminAuth,
    managerAuth,
    optionalAuth
};