// Sql-Backend/index.js

const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, './.env') });

const app = express();
const server = http.createServer(app);

// --- Dynamic CORS Whitelist ---
const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5051',
    'https://gluckscare.com',
    'https://sales-rep-visite.gluckscare.com',
    'https://demo.gluckscare.com',
    'https://gluckscare.rbshstudio.in'
];

const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
    : [];

const allowedOrigins = [...defaultOrigins, ...envOrigins];

function isOriginAllowed(origin) {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    // Allow any *.gluckscare.com, *.rbshstudio.in or localhost port
    if (/^https?:\/\/([a-z0-9-]+\.)*gluckscare\.com(:\d+)?$/.test(origin)) return true;
    if (/^https?:\/\/([a-z0-9-]+\.)*rbshstudio\.in(:\d+)?$/.test(origin)) return true;
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
    return false;
}

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug', 'x-tenant-id'],
        transports: ['websocket', 'polling']
    }
});

// Make io accessible throughout the app
app.set('io', io);

// --- Middleware ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
app.use(helmet());

app.use(cors({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS Blocked Origin]: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug', 'x-tenant-id']
}));

// Initialize database connection & models
const { sequelize, ...models } = require('./src/config/database');
const { initializeDatabase } = require('./src/config/initDatabase');
const { setupSocket } = require('./src/config/socketHandler');
const { initMasterDatabase } = require('./src/platform/masterDb');
const apiRoutes = require('./src/routes/apiRoutes');
const platformRoutes = require('./src/platform/platformRoutes');

// Initialize and start server
async function startServer() {
    const dbConnected = await initializeDatabase(sequelize);

    if (!dbConnected) {
        console.error('❌ Failed to connect to database. Exiting...');
        process.exit(1);
    }

    // Initialize Multi-Tenant Master Database & Registry
    await initMasterDatabase();

    // Set models and sequelize in app for access in controllers
    app.set('models', models);
    app.set('sequelize', sequelize);

    // Setup Socket.IO authentication and event routing
    setupSocket(io, models);

    // Mount Platform Super Admin & Multi-Tenant Provisioning Routes
    app.use('/api/platform', platformRoutes);

    // Mount Central API Routes
    app.use('/api', apiRoutes);

    // Root endpoint
    app.get('/', (req, res) => {
        res.json({
            message: 'GlucksCare ERP PostgreSQL API is running',
            version: '1.0.0',
            database: 'PostgreSQL',
            timestamp: new Date().toISOString()
        });
    });

    // Health check endpoint
    app.get('/health', async (req, res) => {
        try {
            await sequelize.authenticate();
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                database: {
                    type: 'PostgreSQL',
                    connected: true
                },
                uptime: process.uptime(),
                message: 'Server is running with automatic restart enabled!'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                database: {
                    type: 'PostgreSQL',
                    connected: false,
                    error: error.message
                },
                uptime: process.uptime()
            });
        }
    });

    const PORT = process.env.PORT || 5051;
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log('🔌 Socket.IO server initialized');

        // Start background auto punch-out runner (runs every 5 minutes)
        try {
            const { runGlobalAutoPunchOut } = require('./src/attendance/attendanceController');
            setInterval(() => {
                runGlobalAutoPunchOut(app);
            }, 5 * 60 * 1000);
            setTimeout(() => {
                runGlobalAutoPunchOut(app);
            }, 10 * 1000);
            console.log('⏰ Auto punch-out background scheduler initialized (every 5 mins)');
        } catch (schedErr) {
            console.warn('⚠️ Could not initialize auto punch-out scheduler:', schedErr.message);
        }
    });
}

// Handle application termination
process.on('SIGINT', async () => {
    try {
        await sequelize.close();
        console.log('📊 PostgreSQL connection closed through app termination');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error closing PostgreSQL connection:', err);
        process.exit(1);
    }
});

// Start the server
startServer().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});