// Notification Controller - Based on old MongoDB logic, adapted for PostgreSQL

// Send notification
const sendNotification = async (req, res) => {
  try {
    const { Notification, NotificationRecipient, User } = req.app.get('models');
    const { title, body, recipientIds, isBroadcast, senderId } = req.body;

    // Use authenticated user ID or provided senderId
    const actualSenderId = req.user?.id || senderId;

    if (!actualSenderId) {
      return res.status(400).json({ error: 'Sender ID is required' });
    }

    // Create the notification
    const notification = await Notification.create({
      title,
      body,
      sender_id: actualSenderId,
      is_broadcast: isBroadcast || false
    });

    let recipients = [];

    if (isBroadcast) {
      // For broadcast, get all active users and add them as recipients
      const allUsers = await User.findAll({ 
        where: { is_active: true },
        attributes: ['id']
      });
      
      recipients = allUsers.map(user => ({
        notification_id: notification.id,
        user_id: user.id,
        is_read: false
      }));
    } else {
      // For specific users
      recipients = recipientIds.map(userId => ({
        notification_id: notification.id,
        user_id: userId,
        is_read: false
      }));
    }

    // Create notification recipients
    if (recipients.length > 0) {
      await NotificationRecipient.bulkCreate(recipients);
    }

    res.status(201).json({
      success: true,
      data: notification,
      message: `Notification sent to ${recipients.length} recipients`
    });
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(400).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get all notifications for the current user
const getUserNotifications = async (req, res) => {
  try {
    const { Notification, NotificationRecipient, User } = req.app.get('models');
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get all notifications for the user (both direct and broadcast)
    const notifications = await Notification.findAll({
      include: [
        {
          model: User,
          as: 'Sender',
          attributes: ['id', 'name', 'email']
        },
        {
          model: NotificationRecipient,
          as: 'Recipients',
          where: { 
            user_id: userId,
            permanently_dismissed: false 
          },
          required: true
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Transform the response to match old format
    const transformedNotifications = notifications.map(notification => {
      const notificationObj = notification.toJSON();
      const userRecipient = notificationObj.Recipients && notificationObj.Recipients[0];
      
      return {
        _id: notificationObj.id,
        id: notificationObj.id,
        title: notificationObj.title,
        body: notificationObj.body,
        sender: notificationObj.Sender,
        isBroadcast: notificationObj.is_broadcast,
        isRead: userRecipient ? userRecipient.is_read : false,
        readAt: userRecipient ? userRecipient.read_at : null,
        permanentlyDismissed: userRecipient ? userRecipient.permanently_dismissed : false,
        createdAt: notificationObj.created_at,
        updatedAt: notificationObj.updated_at
      };
    });

    res.json(transformedNotifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get only unread notifications for popup
const getUnreadNotifications = async (req, res) => {
  try {
    const { Notification, NotificationRecipient, User } = req.app.get('models');
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get unread notifications for the user
    const notifications = await Notification.findAll({
      include: [
        {
          model: User,
          as: 'Sender',
          attributes: ['id', 'name', 'email']
        },
        {
          model: NotificationRecipient,
          as: 'Recipients',
          where: { 
            user_id: userId,
            is_read: false,
            permanently_dismissed: false 
          },
          required: true
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Transform the response
    const transformedNotifications = notifications.map(notification => {
      const notificationObj = notification.toJSON();
      return {
        _id: notificationObj.id,
        id: notificationObj.id,
        title: notificationObj.title,
        body: notificationObj.body,
        sender: notificationObj.Sender,
        isBroadcast: notificationObj.is_broadcast,
        createdAt: notificationObj.created_at
      };
    });

    res.json(transformedNotifications);
  } catch (err) {
    console.error('Error fetching unread notifications:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get unread notification count for the current user
const getNotificationCount = async (req, res) => {
  try {
    const { NotificationRecipient } = req.app.get('models');
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const count = await NotificationRecipient.count({
      where: {
        user_id: userId,
        is_read: false,
        permanently_dismissed: false
      }
    });

    res.json({ count });
  } catch (err) {
    console.error('Error getting notification count:', err);
    res.status(500).json({ error: err.message });
  }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { NotificationRecipient } = req.app.get('models');
    const userId = req.user?.id || req.body.userId;
    const notificationId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find and update the notification recipient
    const [updatedCount] = await NotificationRecipient.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          notification_id: notificationId,
          user_id: userId
        }
      }
    );

    if (updatedCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ 
      success: true,
      message: 'Notification marked as read' 
    });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: err.message });
  }
};

// Permanently dismiss notification (don't show again)
const dismissNotification = async (req, res) => {
  try {
    const { NotificationRecipient } = req.app.get('models');
    const userId = req.user?.id || req.body.userId;
    const { permanentlyDismissed = true } = req.body;
    const notificationId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find and update the notification recipient
    const [updatedCount] = await NotificationRecipient.update(
      {
        is_read: true,
        read_at: new Date(),
        permanently_dismissed: permanentlyDismissed
      },
      {
        where: {
          notification_id: notificationId,
          user_id: userId
        }
      }
    );

    if (updatedCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ 
      success: true,
      message: 'Notification dismissed' 
    });
  } catch (err) {
    console.error('Error dismissing notification:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete single notification
const deleteNotification = async (req, res) => {
  try {
    const { Notification, NotificationRecipient } = req.app.get('models');
    const userId = req.user?.id || req.body.userId;
    const notificationId = req.params.id;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user is the sender
    const notification = await Notification.findByPk(notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // If user is the sender, delete the entire notification
    if (notification.sender_id === userId) {
      await NotificationRecipient.destroy({
        where: { notification_id: notificationId }
      });
      await notification.destroy();
    } else {
      // If user is a recipient, mark as permanently dismissed
      await NotificationRecipient.update(
        {
          is_read: true,
          read_at: new Date(),
          permanently_dismissed: true
        },
        {
          where: {
            notification_id: notificationId,
            user_id: userId
          }
        }
      );
    }

    res.json({ 
      success: true,
      message: 'Notification deleted' 
    });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: err.message });
  }
};

// Mark all notifications as read for a user
const markAllAsRead = async (req, res) => {
  try {
    const { NotificationRecipient } = req.app.get('models');
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Mark all notifications as read for this user
    await NotificationRecipient.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          user_id: userId,
          is_read: false
        }
      }
    );

    res.json({ 
      success: true,
      message: 'All notifications marked as read' 
    });
  } catch (err) {
    console.error('Error marking all as read:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete all notifications for a user
const deleteAllNotifications = async (req, res) => {
  try {
    const { NotificationRecipient } = req.app.get('models');
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Mark all notifications as permanently dismissed for this user
    await NotificationRecipient.update(
      {
        is_read: true,
        read_at: new Date(),
        permanently_dismissed: true
      },
      {
        where: {
          user_id: userId
        }
      }
    );

    res.json({ 
      success: true,
      message: 'All notifications deleted' 
    });
  } catch (err) {
    console.error('Error deleting all notifications:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  sendNotification,
  getUserNotifications,
  getUnreadNotifications,
  getNotificationCount,
  markNotificationAsRead,
  dismissNotification,
  deleteNotification,
  markAllAsRead,
  deleteAllNotifications
};