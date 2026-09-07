// src/config/socketHandler.js
// Handles Socket.IO authentication middleware and real-time event routing

const jwt = require('jsonwebtoken');

function setupSocket(io, models) {
    // Socket.IO authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const User = models.User;
            const user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] }
            });

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.user = user;
            next();
        } catch (error) {
            console.error('Socket.IO authentication error:', error);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
        console.log('👤 Client connected:', socket.id);

        // Join user-specific room for attendance updates
        socket.on('join-user-room', (userId) => {
            socket.join(`user-${userId}`);
            console.log(`👤 User ${userId} joined their room`);
        });

        // GPS Tracking - Join location tracking room
        socket.on('join-location-tracking', (data) => {
            const { userId, userType } = data || {};

            if (userType === 'admin') {
                socket.join('admin-location-tracking');
                console.log('👨‍💼 Admin client joined location tracking');
            } else if (userId) {
                socket.join(`user-location-${userId}`);
                console.log(`📍 User ${userId} joined location tracking`);
            }
        });

        // GPS Tracking - Handle real-time location updates
        socket.on('location-update', (data) => {
            const { userId } = data || {};
            if (userId) {
                io.to('admin-location-tracking').emit('user-location-update', {
                    userId,
                    ...data,
                    timestamp: new Date().toISOString()
                });
            }
        });

        socket.on('disconnect', () => {
            console.log('👤 Client disconnected:', socket.id);
        });
    });
}

module.exports = { setupSocket };
