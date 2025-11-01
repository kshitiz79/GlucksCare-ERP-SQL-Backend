// src/utils/mockDataRoutes.js

const express = require('express');
const router = express.Router();
const MockLocationGenerator = require('./mockLocationGenerator');
const AutoLocationSimulator = require('./autoLocationSimulator');

// Create instances
const mockGenerator = new MockLocationGenerator();
const autoSimulator = new AutoLocationSimulator();

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

module.exports = router;