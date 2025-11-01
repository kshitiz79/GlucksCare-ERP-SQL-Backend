// Sql-Backend/index.js

const express = require('express');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// --- CORS Configuration (MUST be first) ---
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5051', // Add this for development
    'https://gluckscare.com',
    'https://www.gluckscare.com', // Add www subdomain
    'https://test.gluckscare.com', // Add test domain
    'https://sales-rep-visite.gluckscare.com',
    'https://api.gluckscare.com', // Add this for production frontend
    // Add any other subdomains that might be used
    'https://admin.gluckscare.com',
    'https://app.gluckscare.com'
];

// Socket.IO setup (after allowedOrigins is defined)
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, // Use the same allowed origins array
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        transports: ['websocket', 'polling']
    }
});

// Make io accessible throughout the app
app.set('io', io);

// Manual CORS middleware (more reliable than cors package for complex scenarios)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Set CORS headers for all requests
    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        console.log('Preflight request from origin:', origin);
        return res.sendStatus(200);
    }
    
    console.log(`${req.method} ${req.path} - Origin: ${origin || 'none'}`);
    next();
});

// --- Other Middleware ---
app.use(express.json({ limit: '25mb' }));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Initialize database connection
const { sequelize, ...models } = require('./src/config/database');

// Test database connection and sync models
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established successfully');
    
    // Sync database (create tables if they don't exist)
    // In production, use migrations instead
    await sequelize.sync({ alter: false });
    console.log('✅ Database synchronized');
    
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to PostgreSQL:', error);
    return false;
  }
}

// Initialize server
async function startServer() {
  const dbConnected = await initializeDatabase();
  
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Set models and sequelize in app for access in controllers
  app.set('models', models);
  app.set('sequelize', sequelize);

  // Initialize auto-start services (location simulation and cleanup)
  const autoStartService = require('./src/utils/autoStartService');
  await autoStartService.initialize(models, sequelize);

  // Add Socket.IO authentication middleware (after models are available)
  io.use(async (socket, next) => {
    try {
      // Get token from socket handshake
      const token = socket.handshake.auth?.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database (using the sequelize instance)
      const User = models.User;
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Add user to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket.IO authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Import and mount routes after database connection
  const authRoutes = require('./src/auth/authRoutes');
  const userRoutes = require('./src/user/userRoutes');
  const masterRoutes = require('./src/user/masterRoutes');
  const headOfficeRoutes = require('./src/headoffice/headOfficeRoutes');
  const stateRoutes = require('./src/state/stateRoutes');
  const doctorRoutes = require('./src/doctor/doctorRoutes');

  const attendanceRoutes = require('./src/attendance/attendanceRoutes');
  const leaveRoutes = require('./src/leave/leaveRoutes');
  const leaveTypeRoutes = require('./src/leaveType/leaveTypeRoutes');
  const shiftRoutes = require('./src/shift/shiftRoutes');
  const locationRoutes = require('./src/location/locationRoutes');
  const locationHistoryRoutes = require('./src/locationHistory/locationHistoryRoutes');
  const locationEventRoutes = require('./src/locationEvent/locationEventRoutes');
  const stopEventsRoutes = require('./src/stopEvents/stopEventsRoutes');
  const expenseRoutes = require('./src/expencse/expenseRoutes');
  const expenseSettingRoutes = require('./src/expenseSetting/expenseSettingRoutes');
  const payrollSettingRoutes = require('./src/payrollSetting/payrollSettingRoutes');
  const notificationRoutes = require('./src/notification/notificationRoutes');
  const notificationRecipientRoutes = require('./src/notificationRecipient/notificationRecipientRoutes');
  const ticketRoutes = require('./src/ticket/ticketRoutes');
  const holidayRoutes = require('./src/holiday/holidayRoutes');
  const userHeadOfficeRoutes = require('./src/userHeadOffice/userHeadOfficeRoutes');
  const userManagerRoutes = require('./src/userManager/userManagerRoutes');
  const userShiftRoutes = require('./src/userShift/userShiftRoutes');
  // New routes for stockists and chemists
  const stockistRoutes = require('./src/stockist/stockistRoutes');
  const chemistRoutes = require('./src/chemist/chemistRoutes');
  const pdfRoutes = require('./src/pdf/pdfRoutes');
  // Product routes
  const productRoutes = require('./src/product/productRoutes');

// Version routes
  const versionRoutes = require('./src/version/versionRoutes');
  
// New routes
  const branchRoutes = require('./src/branch/branchRoutes');
  const departmentRoutes = require('./src/department/departmentRoutes');
  const designationRoutes = require('./src/designation/designationRoutes');
  const employmentTypeRoutes = require('./src/employmentType/employmentTypeRoutes');
  const doctorVisitHistoryRoutes = require('./src/doctorVisitHistory/doctorVisitHistoryRoutes');
  const chemistAnnualTurnoverRoutes = require('./src/chemistAnnualTurnover/chemistAnnualTurnoverRoutes');
  const stockistAnnualTurnoverRoutes = require('./src/stockistAnnualTurnover/stockistAnnualTurnoverRoutes');
  const salesTargetRoutes = require('./src/salesTarget/salesTargetRoutes');
  const doctorVisitRoutes = require('./src/doctorVisit/doctorVisitRoutes');
  const chemistVisitRoutes = require('./src/chemistVisit/chemistVisitRoutes');
  const stockistVisitRoutes = require('./src/stockistVisit/stockistVisitRoutes');
  const visitProductPromotedRoutes = require('./src/visitProductPromoted/visitProductPromotedRoutes');
  const visitProductAgreedRoutes = require('./src/visitProductAgreed/visitProductAgreedRoutes');
  const visitProductNotAgreedRoutes = require('./src/visitProductNotAgreed/visitProductNotAgreedRoutes');
  // const locationEventRoutes = require('./src/locationEvent/locationEventRoutes');

// Add this with the other route imports (around line 95)
const dashboardRoutes = require('./src/dashboard/dashboardRoutes');

// Add this with the other route mounts (around line 205)
app.use('/api/dashboard', dashboardRoutes);

// Web dashboard routes (optimized for web frontend)
const webDashboardRoutes = require('./src/webDashboard/webDashboardRoutes');
app.use('/api/web-dashboard', webDashboardRoutes);

// Mock data routes for testing
const mockDataRoutes = require('./src/utils/mockDataRoutes');
app.use('/api/mock-data', mockDataRoutes);






  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/master', masterRoutes);
  app.use('/api/headoffices', headOfficeRoutes);
  app.use('/api/states', stateRoutes);
  app.use('/api/doctors', doctorRoutes);

  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/leave-types', leaveTypeRoutes);
  app.use('/api/shifts', shiftRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/location-histories', locationHistoryRoutes);
  app.use('/api/location-events', locationEventRoutes);
  app.use('/api/stop-events', stopEventsRoutes);
  
  // New route mounts
  app.use('/api/branches', branchRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/designations', designationRoutes);
  app.use('/api/employment-types', employmentTypeRoutes);
  app.use('/api/doctor-visit-histories', doctorVisitHistoryRoutes);
  app.use('/api/chemist-annual-turnovers', chemistAnnualTurnoverRoutes);
  app.use('/api/stockist-annual-turnovers', stockistAnnualTurnoverRoutes);
  app.use('/api/sales-targets', salesTargetRoutes);
  app.use('/api/doctor-visits', doctorVisitRoutes);
  app.use('/api/chemist-visits', chemistVisitRoutes);
  app.use('/api/stockist-visits', stockistVisitRoutes);
  app.use('/api/visit-products-promoted', visitProductPromotedRoutes);
  app.use('/api/visit-products-agreed', visitProductAgreedRoutes);
  app.use('/api/visit-products-not-agreed', visitProductNotAgreedRoutes);

  app.use('/api/expenses', expenseRoutes);
  app.use('/api/expense-settings', expenseSettingRoutes);
  app.use('/api/payroll-settings', payrollSettingRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/notification-recipients', notificationRecipientRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/holidays', holidayRoutes);
  app.use('/api/user-head-offices', userHeadOfficeRoutes);
  app.use('/api/user-managers', userManagerRoutes);
  app.use('/api/user-shifts', userShiftRoutes);
  // Mount stockist and chemist routes
  app.use('/api/stockists', stockistRoutes);
  app.use('/api/chemists', chemistRoutes);
  app.use('/api/pdfs', pdfRoutes);
  // Mount product routes
  app.use('/api/products', productRoutes);

  // Mount version routes
  app.use('/api/version', versionRoutes);



  // CORS test endpoint
  app.get('/cors-test', (req, res) => {
    res.json({
      message: 'CORS test successful',
      origin: req.headers.origin,
      timestamp: new Date().toISOString(),
      allowedOrigins: allowedOrigins
    });
  });

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
          const { userId, userType } = data;

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
          const { userId } = data;
          if (userId) {
              // Broadcast to admin clients
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