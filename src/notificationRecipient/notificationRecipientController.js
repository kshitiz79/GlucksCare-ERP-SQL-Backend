const NotificationRecipient = require('./NotificationRecipient');

// GET all notification recipients
const getAllNotificationRecipients = async (req, res) => {
  try {
    const notificationRecipients = await NotificationRecipient.findAll();
    res.json({
      success: true,
      count: notificationRecipients.length,
      data: notificationRecipients
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET notification recipient by ID
const getNotificationRecipientById = async (req, res) => {
  try {
    const notificationRecipient = await NotificationRecipient.findByPk(req.params.id);
    if (!notificationRecipient) {
      return res.status(404).json({
        success: false,
        message: 'Notification recipient not found'
      });
    }
    res.json({
      success: true,
      data: notificationRecipient
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new notification recipient
const createNotificationRecipient = async (req, res) => {
  try {
    const notificationRecipient = await NotificationRecipient.create(req.body);
    res.status(201).json({
      success: true,
      data: notificationRecipient
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a notification recipient
const updateNotificationRecipient = async (req, res) => {
  try {
    const notificationRecipient = await NotificationRecipient.findByPk(req.params.id);
    if (!notificationRecipient) {
      return res.status(404).json({
        success: false,
        message: 'Notification recipient not found'
      });
    }
    
    await notificationRecipient.update(req.body);
    res.json({
      success: true,
      data: notificationRecipient
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a notification recipient
const deleteNotificationRecipient = async (req, res) => {
  try {
    const notificationRecipient = await NotificationRecipient.findByPk(req.params.id);
    if (!notificationRecipient) {
      return res.status(404).json({
        success: false,
        message: 'Notification recipient not found'
      });
    }
    
    await notificationRecipient.destroy();
    res.json({
      success: true,
      message: 'Notification recipient deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllNotificationRecipients,
  getNotificationRecipientById,
  createNotificationRecipient,
  updateNotificationRecipient,
  deleteNotificationRecipient
};