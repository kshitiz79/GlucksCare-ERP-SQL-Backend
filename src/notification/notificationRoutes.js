const express = require('express');
const router = express.Router();
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');
const {
  sendNotification,
  getUserNotifications,
  getUnreadNotifications,
  getNotificationCount,
  markNotificationAsRead,
  dismissNotification,
  deleteNotification,
  markAllAsRead,
  deleteAllNotifications
} = require('./notificationController');

// Send notification (authenticated users - temporarily allowing all for testing)
router.post('/', authMiddleware, sendNotification);

// Get all notifications for the current user
router.get('/', authMiddleware, getUserNotifications);

// Get only unread notifications for popup
router.get('/unread', authMiddleware, getUnreadNotifications);

// Get unread notification count for the current user
router.get('/count', authMiddleware, getNotificationCount);

// Mark notification as read
router.patch('/:id/read', authMiddleware, markNotificationAsRead);

// Permanently dismiss notification (don't show again)
router.patch('/:id/dismiss', authMiddleware, dismissNotification);

// Delete single notification
router.delete('/:id', authMiddleware, deleteNotification);

// Mark all notifications as read for a user
router.patch('/mark-all-read', authMiddleware, markAllAsRead);

// Delete all notifications for a user
router.delete('/', authMiddleware, deleteAllNotifications);

module.exports = router;