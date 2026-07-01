const { OfflineBgTracking } = require('../config/database');

const createOfflineBgTracking = async (req, res) => {
  try {
    const { user_id, device_id, records, data } = req.body;

    // Support receiving either an array directly, or a wrapped object
    let trackingRecords = [];
    let commonUserId = user_id || (req.user && req.user.id);
    let commonDeviceId = device_id;

    if (Array.isArray(req.body)) {
      trackingRecords = req.body;
    } else if (Array.isArray(records)) {
      trackingRecords = records;
    } else if (Array.isArray(data)) {
      trackingRecords = data;
    } else {
      // If it's a single object that has details
      if (req.body.entity_type && req.body.payload) {
        trackingRecords = [req.body];
      }
    }

    if (!trackingRecords || trackingRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No tracking records provided or invalid format'
      });
    }

    // Map user_id and device_id from the outer object onto each record
    const recordsToInsert = trackingRecords.map(record => {
      return {
        user_id: record.user_id || commonUserId || null,
        device_id: record.device_id || commonDeviceId || null,
        entity_type: record.entity_type,
        entity_id: record.entity_id,
        payload: record.payload,
        status: record.status || 'PENDING',
        retry_count: record.retry_count || 0,
        created_at_utc: record.created_at_utc || new Date(),
        last_attempt_utc: record.last_attempt_utc || null
      };
    });

    // Validate that required fields are present
    for (const record of recordsToInsert) {
      if (!record.device_id) {
        return res.status(400).json({
          success: false,
          message: 'device_id is required for all records'
        });
      }
      if (!record.entity_type || !record.entity_id || !record.payload) {
        return res.status(400).json({
          success: false,
          message: 'entity_type, entity_id, and payload are required for all records'
        });
      }
    }

    // Bulk create records (handling duplicates on entity_id)
    const result = await OfflineBgTracking.bulkCreate(recordsToInsert, {
      updateOnDuplicate: ['status', 'retry_count', 'last_attempt_utc', 'payload']
    });

    res.status(201).json({
      success: true,
      message: `${result.length} tracking records stored successfully`,
      count: result.length
    });
  } catch (error) {
    console.error('Error creating offline bg tracking records:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save offline tracking records'
    });
  }
};

const getAllOfflineBgTracking = async (req, res) => {
  try {
    const records = await OfflineBgTracking.findAll({
      order: [['created_at_utc', 'DESC']]
    });
    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getOfflineBgTrackingById = async (req, res) => {
  try {
    const record = await OfflineBgTracking.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Offline tracking record not found'
      });
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createOfflineBgTracking,
  getAllOfflineBgTracking,
  getOfflineBgTrackingById
};
