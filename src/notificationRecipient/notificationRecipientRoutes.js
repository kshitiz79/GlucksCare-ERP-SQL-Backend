const express = require('express');
const router = express.Router();
const {
  getAllNotificationRecipients,
  getNotificationRecipientById,
  createNotificationRecipient,
  updateNotificationRecipient,
  deleteNotificationRecipient
} = require('./notificationRecipientController');

// GET all notification recipients
router.get('/', getAllNotificationRecipients);

// GET notification recipient by ID
router.get('/:id', getNotificationRecipientById);

// CREATE a new notification recipient
router.post('/', createNotificationRecipient);

// UPDATE a notification recipient
router.put('/:id', updateNotificationRecipient);

// DELETE a notification recipient
router.delete('/:id', deleteNotificationRecipient);

module.exports = router;