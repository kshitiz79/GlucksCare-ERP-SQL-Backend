// src/utils/mockDataRoutes.js

const express = require('express');
const router = express.Router();
const MockLocationGenerator = require('./mockLocationGenerator');
const AutoLocationSimulator = require('./autoLocationSimulator');
const LocationCleanupService = require('./locationCleanupService');

// Create instances
const mockGenerator = new MockLocationGenerator();
const autoSimulator = new AutoLocationSimulator();

// Cleanup service will be initialized when models are available
let cleanupService = null;

// Initialize cleanup service with models
const initializeCleanupService = (req) => {
  if (!cleanupService) {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');
    cleanupService = new LocationCleanupService(models, sequelize);
    // Auto-start cleanup service
    cleanupService.startAutomaticCleanup();
  }
  return cleanupService;
};

// Start mock data generation
router.post('/start', async (req, res) => {
  try {
    const { userIds = [1, 2, 3, 4, 5], intervalSeconds = 10 } = req.body;
    
    mockGenerator.startMockData(userIds, intervalSeconds);
    
    res.json({
      success: true,
      message: 'Mock location data generation started',
      data: {
        userIds,
        intervalSeconds,
        status: mockGenerator.getStatus()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start mock data generation',
      error: error.message
    });
  }
});

// Stop mock data generation
router.post('/stop', async (req, res) => {
  try {
    mockGenerator.stopMockData();
    
    res.json({
      success: true,
      message: 'Mock location data generation stopped',
      data: mockGenerator.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop mock data generation',
      error: error.message
    });
  }
});

// Get mock data generator status
router.get('/status', (req, res) => {
  try {
    const status = mockGenerator.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get status',
      error: error.message
    });
  }
});

// Send a single test location update
router.post('/test-location', async (req, res) => {
  try {
    const { userId = 1 } = req.body;
    
    const result = await mockGenerator.sendTestLocation(userId);
    
    res.json({
      success: true,
      message: 'Test location update sent',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send test location',
      error: error.message
    });
  }
});

// Auto-start realistic location simulation
router.post('/auto-start', async (req, res) => {
  try {
    const userIds = await autoSimulator.autoStartForActiveUsers();
    
    res.json({
      success: true,
      message: 'Auto location simulation started',
      data: {
        userIds,
        status: autoSimulator.getStatus()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start auto simulation',
      error: error.message
    });
  }
});

// Stop auto simulation
router.post('/auto-stop', async (req, res) => {
  try {
    autoSimulator.stopAll();
    
    res.json({
      success: true,
      message: 'Auto location simulation stopped',
      data: autoSimulator.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop auto simulation',
      error: error.message
    });
  }
});

// Get auto simulation status
router.get('/auto-status', (req, res) => {
  try {
    const status = autoSimulator.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get auto simulation status',
      error: error.message
    });
  }
});

// Manual cleanup trigger
router.post('/cleanup', async (req, res) => {
  try {
    const cleanup = initializeCleanupService(req);
    const result = await cleanup.runManualCleanup();
    
    res.json({
      success: true,
      message: 'Manual cleanup completed',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to run cleanup',
      error: error.message
    });
  }
});

// Get cleanup service status
router.get('/cleanup-status', (req, res) => {
  try {
    const cleanup = initializeCleanupService(req);
    const status = cleanup.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get cleanup status',
      error: error.message
    });
  }
});

// Update cleanup configuration
router.post('/cleanup-config', (req, res) => {
  try {
    const { retentionHours = 24, intervalHours = 1 } = req.body;
    const cleanup = initializeCleanupService(req);
    
    cleanup.updateConfig(retentionHours, intervalHours);
    
    res.json({
      success: true,
      message: 'Cleanup configuration updated',
      data: cleanup.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update cleanup configuration',
      error: error.message
    });
  }
});

module.exports = router;