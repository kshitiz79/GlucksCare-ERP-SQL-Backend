// src/services/jwt.service.js

const jwt = require('jsonwebtoken');

class JwtService {
    static generateToken(payload, expiresIn = '30d') {
        return jwt.sign(
            payload,
            process.env.JWT_SECRET || 'fallback-secret-for-debug',
            { expiresIn }
        );
    }

    static verifyToken(token) {
        return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-for-debug');
    }
}

module.exports = JwtService;
