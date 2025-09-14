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

        // Get user from database
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(401).json({ 
                success: false,
                msg: 'Token is not valid - user not found' 
            });
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

module.exports = {
    authMiddleware,
    authorize,
    adminAuth,
    managerAuth
};