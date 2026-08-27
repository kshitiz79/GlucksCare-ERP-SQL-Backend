// src/companyDevice/companyDeviceController.js
const { Op } = require('sequelize');

// Helper to format dates to YYYY-MM-DD
const formatDateYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// GET all company devices with search and filters
const getAllCompanyDevices = async (req, res) => {
  try {
    const { CompanyDevice, User, DeviceAssignmentHistory, HeadOffice, Designation, Department } = req.app.get('models');
    const { status, brand, search, unassigned } = req.query;

    const whereClause = {};

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (brand) {
      whereClause.brand = { [Op.iLike]: `%${brand}%` };
    }

    if (unassigned === 'true') {
      whereClause.current_user_id = null;
    }

    if (search) {
      whereClause[Op.or] = [
        { company_device_id: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } },
        { model: { [Op.iLike]: `%${search}%` } },
        { imei_1: { [Op.iLike]: `%${search}%` } },
        { serial_number: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const devices = await CompanyDevice.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'currentUser',
          attributes: ['id', 'name', 'email', 'employee_code', 'role', 'mobile_number'],
          required: false,
          include: [
            {
              model: HeadOffice,
              attributes: ['id', 'name', 'stateId', 'pincode'],
              required: false
            },
            {
              model: Designation,
              as: 'designation',
              attributes: ['id', 'name'],
              required: false
            },
            {
              model: Department,
              as: 'Department',
              attributes: ['id', 'name'],
              required: false
            }
          ]
        },
        {
          model: DeviceAssignmentHistory,
          as: 'assignmentHistory',
          required: false,
          limit: 5,
          order: [['assigned_at', 'DESC']],
          include: [
            {
              model: User,
              as: 'employee',
              attributes: ['id', 'name', 'employee_code'],
              required: false
            }
          ]
        }
      ],
      order: [['company_device_id', 'ASC']]
    });

    // Auto-sync live app versions from Version management table
    const { Version } = req.app.get('models') || {};
    const userIds = devices.map(d => d.current_user_id).filter(Boolean);
    const versionsMap = {};
    if (Version && userIds.length > 0) {
      try {
        const userVersions = await Version.findAll({
          where: { user_id: userIds },
          order: [['last_check_date', 'DESC'], ['created_at', 'DESC']]
        });
        userVersions.forEach(v => {
          if (!versionsMap[v.user_id]) {
            versionsMap[v.user_id] = v;
          }
        });
      } catch (vErr) {
        console.warn('Error fetching versions for company devices:', vErr.message);
      }
    }

    const enhancedDevices = devices.map(d => {
      const plain = d.toJSON();
      if (d.current_user_id && versionsMap[d.current_user_id]) {
        const v = versionsMap[d.current_user_id];
        const vStr = v.current_version.startsWith('v') ? v.current_version : `v${v.current_version}`;
        plain.app_version = vStr;
        if (v.device_info) {
          if (v.device_info.osVersion || v.device_info.androidVersion) {
            plain.android_version = v.device_info.osVersion || v.device_info.androidVersion;
          }
          if (v.device_info.brand && (!plain.brand || plain.brand === 'Samsung')) {
            plain.brand = v.device_info.brand;
          }
          if (v.device_info.model && (!plain.model || plain.model === 'Galaxy Tab A9+')) {
            plain.model = v.device_info.model;
          }
        }
      }
      return plain;
    });

    // Summary statistics
    const totalCount = enhancedDevices.length;
    const activeCount = enhancedDevices.filter(d => d.status === 'ACTIVE').length;
    const inStockCount = enhancedDevices.filter(d => d.status === 'IN_STOCK' || !d.current_user_id).length;
    const inRepairCount = enhancedDevices.filter(d => d.status === 'IN_REPAIR' || d.status === 'DAMAGED').length;
    const onlineCount = enhancedDevices.filter(d => d.is_online).length;

    res.json({
      success: true,
      data: enhancedDevices,
      stats: {
        total: totalCount,
        active: activeCount,
        inStock: inStockCount,
        inRepair: inRepairCount,
        online: onlineCount
      }
    });
  } catch (error) {
    console.error('Get all company devices error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET single company device by ID
const getCompanyDeviceById = async (req, res) => {
  try {
    const { CompanyDevice, User, DeviceAssignmentHistory, HeadOffice, Designation, Department, Version } = req.app.get('models');
    const { id } = req.params;

    const device = await CompanyDevice.findByPk(id, {
      include: [
        {
          model: User,
          as: 'currentUser',
          attributes: ['id', 'name', 'email', 'employee_code', 'role', 'mobile_number'],
          required: false,
          include: [
            {
              model: HeadOffice,
              attributes: ['id', 'name', 'stateId', 'pincode'],
              required: false
            },
            {
              model: Designation,
              as: 'designation',
              attributes: ['id', 'name'],
              required: false
            },
            {
              model: Department,
              as: 'Department',
              attributes: ['id', 'name'],
              required: false
            }
          ]
        },
        {
          model: DeviceAssignmentHistory,
          as: 'assignmentHistory',
          required: false,
          order: [['assigned_at', 'DESC']],
          include: [
            {
              model: User,
              as: 'employee',
              attributes: ['id', 'name', 'employee_code', 'email'],
              required: false
            }
          ]
        }
      ]
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Company device not found' });
    }

    const plain = device.toJSON();
    if (device.current_user_id && Version) {
      try {
        const v = await Version.findOne({
          where: { user_id: device.current_user_id },
          order: [['last_check_date', 'DESC'], ['created_at', 'DESC']]
        });
        if (v) {
          plain.app_version = v.current_version.startsWith('v') ? v.current_version : `v${v.current_version}`;
          if (v.device_info) {
            if (v.device_info.osVersion || v.device_info.androidVersion) {
              plain.android_version = v.device_info.osVersion || v.device_info.androidVersion;
            }
          }
        }
      } catch (err) {}
    }

    res.json({ success: true, data: plain });
  } catch (error) {
    console.error('Get company device by ID error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE a new company device
const createCompanyDevice = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { CompanyDevice, DeviceAssignmentHistory } = req.app.get('models');
    const {
      company_device_id,
      brand = 'Samsung',
      model = 'Galaxy Tab A9+',
      imei_1,
      imei_2,
      serial_number,
      android_id,
      android_version,
      app_version,
      mdm_enrollment_id,
      current_user_id,
      status = 'IN_STOCK',
      notes
    } = req.body;

    if (!company_device_id || !company_device_id.trim()) {
      return res.status(400).json({ success: false, message: 'Company Device ID (e.g. GSC-TAB-0042) is required' });
    }

    // Check uniqueness
    const existing = await CompanyDevice.findOne({
      where: {
        [Op.or]: [
          { company_device_id: company_device_id.trim() },
          ...(imei_1 ? [{ imei_1: imei_1.trim() }] : [])
        ]
      },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: existing.company_device_id === company_device_id.trim()
          ? `Device ID ${company_device_id} already exists`
          : `IMEI ${imei_1} already registered with another device`
      });
    }

    const newDevice = await CompanyDevice.create({
      company_device_id: company_device_id.trim(),
      brand: brand.trim(),
      model: model.trim(),
      imei_1: imei_1 ? imei_1.trim() : null,
      imei_2: imei_2 ? imei_2.trim() : null,
      serial_number: serial_number ? serial_number.trim() : null,
      android_id: android_id ? android_id.trim() : null,
      android_version: android_version ? android_version.trim() : 'Android 14',
      app_version: app_version ? app_version.trim() : 'v2.4.1',
      mdm_enrollment_id: mdm_enrollment_id ? mdm_enrollment_id.trim() : null,
      current_user_id: current_user_id || null,
      status: current_user_id ? 'ACTIVE' : (status || 'IN_STOCK'),
      assigned_at: current_user_id ? new Date() : null,
      notes: notes ? notes.trim() : null
    }, { transaction });

    // If assigned on creation, log assignment history
    if (current_user_id) {
      await DeviceAssignmentHistory.create({
        device_id: newDevice.id,
        user_id: current_user_id,
        assigned_at: new Date(),
        action_type: 'ASSIGNED',
        reason: 'Initial assignment upon device registration',
        assigned_by: req.user?.id || null,
        is_current: true
      }, { transaction });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Company device registered successfully',
      data: newDevice
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Create company device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE company device
const updateCompanyDevice = async (req, res) => {
  try {
    const { CompanyDevice } = req.app.get('models');
    const { id } = req.params;
    const {
      company_device_id,
      brand,
      model,
      imei_1,
      imei_2,
      serial_number,
      android_id,
      android_version,
      app_version,
      mdm_enrollment_id,
      status,
      notes
    } = req.body;

    const device = await CompanyDevice.findByPk(id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Company device not found' });
    }

    if (company_device_id && company_device_id.trim() !== device.company_device_id) {
      const duplicate = await CompanyDevice.findOne({
        where: {
          company_device_id: company_device_id.trim(),
          id: { [Op.ne]: id }
        }
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Device ID ${company_device_id} already in use` });
      }
      device.company_device_id = company_device_id.trim();
    }

    if (brand !== undefined) device.brand = brand;
    if (model !== undefined) device.model = model;
    if (imei_1 !== undefined) device.imei_1 = imei_1 ? imei_1.trim() : null;
    if (imei_2 !== undefined) device.imei_2 = imei_2 ? imei_2.trim() : null;
    if (serial_number !== undefined) device.serial_number = serial_number ? serial_number.trim() : null;
    if (android_id !== undefined) device.android_id = android_id ? android_id.trim() : null;
    if (android_version !== undefined) device.android_version = android_version;
    if (app_version !== undefined) device.app_version = app_version;
    if (mdm_enrollment_id !== undefined) device.mdm_enrollment_id = mdm_enrollment_id;
    if (status !== undefined) device.status = status;
    if (notes !== undefined) device.notes = notes;

    await device.save();

    res.json({
      success: true,
      message: 'Company device updated successfully',
      data: device
    });
  } catch (error) {
    console.error('Update company device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ASSIGN / REASSIGN device to an employee
const assignCompanyDevice = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { CompanyDevice, DeviceAssignmentHistory, User } = req.app.get('models');
    const { id } = req.params;
    const { user_id, reason, action_type = 'ASSIGNED' } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'Target Employee User ID is required' });
    }

    const device = await CompanyDevice.findByPk(id, { transaction });
    if (!device) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Company device not found' });
    }

    const employee = await User.findByPk(user_id, { transaction });
    if (!employee) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const oldUserId = device.current_user_id;

    // If already assigned to someone, close out previous active assignment history
    if (oldUserId) {
      await DeviceAssignmentHistory.update(
        {
          unassigned_at: new Date(),
          is_current: false
        },
        {
          where: {
            device_id: id,
            is_current: true
          },
          transaction
        }
      );
    }

    // Close any previous active device assignments for this user if they had another tablet
    await DeviceAssignmentHistory.update(
      {
        unassigned_at: new Date(),
        is_current: false
      },
      {
        where: {
          user_id: user_id,
          is_current: true
        },
        transaction
      }
    );

    // Update device record
    device.current_user_id = user_id;
    device.status = 'ACTIVE';
    device.assigned_at = new Date();
    await device.save({ transaction });

    // Create new assignment history log
    const historyEntry = await DeviceAssignmentHistory.create({
      device_id: id,
      user_id: user_id,
      assigned_at: new Date(),
      action_type: action_type || (oldUserId ? 'REPLACED' : 'ASSIGNED'),
      reason: reason || (oldUserId ? `Transferred from previous user` : 'Assigned to employee'),
      assigned_by: req.user?.id || null,
      is_current: true
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Device ${device.company_device_id} successfully assigned to ${employee.name}` ,
      data: {
        device,
        history: historyEntry
      }
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Assign company device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// UNASSIGN / RETURN device to stock
const unassignCompanyDevice = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { CompanyDevice, DeviceAssignmentHistory } = req.app.get('models');
    const { id } = req.params;
    const { reason = 'Returned to inventory', status = 'IN_STOCK', action_type = 'RETURNED' } = req.body;

    const device = await CompanyDevice.findByPk(id, { transaction });
    if (!device) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Company device not found' });
    }

    // Close out active assignment history
    if (device.current_user_id) {
      await DeviceAssignmentHistory.update(
        {
          unassigned_at: new Date(),
          is_current: false,
          reason: reason
        },
        {
          where: {
            device_id: id,
            is_current: true
          },
          transaction
        }
      );
    }

    device.current_user_id = null;
    device.status = status || 'IN_STOCK';
    device.assigned_at = null;
    await device.save({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Device ${device.company_device_id} unassigned and marked as ${device.status}`,
      data: device
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Unassign company device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET employee's complete device change & replacement history
const getEmployeeDeviceHistory = async (req, res) => {
  try {
    const { DeviceAssignmentHistory, CompanyDevice, User, Designation, HeadOffice } = req.app.get('models');
    const { userId } = req.params;

    const employee = await User.findByPk(userId, {
      attributes: ['id', 'name', 'email', 'employee_code', 'role', 'mobile_number'],
      include: [
        {
          model: HeadOffice,
          attributes: ['id', 'name', 'stateId', 'pincode'],
          required: false
        },
        {
          model: Designation,
          as: 'designation',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const history = await DeviceAssignmentHistory.findAll({
      where: { user_id: userId },
      include: [
        {
          model: CompanyDevice,
          as: 'device',
          attributes: ['id', 'company_device_id', 'brand', 'model', 'imei_1', 'serial_number', 'status', 'battery_pct', 'is_online', 'last_sync_at']
        },
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [['assigned_at', 'DESC']]
    });

    res.json({
      success: true,
      employee,
      history
    });
  } catch (error) {
    console.error('Get employee device history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET device location route & telemetry timeline with Date & Time Range filters (e.g. 09:00 AM - 07:00 PM)
const getDeviceTimeline = async (req, res) => {
  try {
    const { CompanyDevice, LocationPing, User } = req.app.get('models');
    const { id } = req.params;
    const { date, startDate, endDate, startTime = '00:00', endTime = '23:59', limit = 2000 } = req.query;

    const device = await CompanyDevice.findByPk(id, {
      include: [
        {
          model: User,
          as: 'currentUser',
          attributes: ['id', 'name', 'employee_code', 'role']
        }
      ]
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Company device not found' });
    }

    // Calculate UTC time boundaries
    const targetDate = date || startDate || formatDateYMD(new Date());
    const targetEndDate = endDate || targetDate;

    const startDateTimeStr = `${targetDate}T${startTime}:00.000Z`;
    const endDateTimeStr = `${targetEndDate}T${endTime}:59.999Z`;

    // Query LocationPing matching device_id or user_id in the time window
    const pings = await LocationPing.findAll({
      where: {
        [Op.or]: [
          { device_id: device.company_device_id },
          ...(device.android_id ? [{ device_id: device.android_id }] : []),
          ...(device.current_user_id ? [{ user_id: device.current_user_id }] : [])
        ],
        device_time_utc: {
          [Op.between]: [new Date(startDateTimeStr), new Date(endDateTimeStr)]
        }
      },
      order: [['device_time_utc', 'ASC']],
      limit: parseInt(limit, 10) || 2000
    });

    // Format route waypoints for map rendering
    const route = pings.map((p, index) => ({
      id: p.id,
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
      accuracy: p.accuracy_m ? parseFloat(p.accuracy_m) : null,
      speed_kmh: p.speed_mps ? (parseFloat(p.speed_mps) * 3.6).toFixed(1) : '0',
      battery_pct: p.battery_pct ? parseFloat(p.battery_pct) : null,
      network_type: p.network_type || 'Cellular',
      timestamp: p.device_time_utc,
      is_start: index === 0,
      is_end: index === pings.length - 1
    }));

    res.json({
      success: true,
      device: {
        id: device.id,
        company_device_id: device.company_device_id,
        brand: device.brand,
        model: device.model,
        battery_pct: device.battery_pct,
        is_online: device.is_online,
        last_sync_at: device.last_sync_at,
        currentUser: device.currentUser
      },
      filter: {
        startDate: targetDate,
        endDate: targetEndDate,
        startTime,
        endTime
      },
      totalPoints: route.length,
      route
    });
  } catch (error) {
    console.error('Get device timeline error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE / Retire company device
const deleteCompanyDevice = async (req, res) => {
  try {
    const { CompanyDevice, DeviceAssignmentHistory } = req.app.get('models');
    const { id } = req.params;

    const device = await CompanyDevice.findByPk(id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Company device not found' });
    }

    // Soft retire
    device.status = 'RETIRED';
    device.current_user_id = null;
    await device.save();

    await DeviceAssignmentHistory.update(
      { is_current: false, unassigned_at: new Date(), reason: 'Device retired/deleted from active fleet' },
      { where: { device_id: id, is_current: true } }
    );

    res.json({ success: true, message: `Device ${device.company_device_id} marked as RETIRED` });
  } catch (error) {
    console.error('Delete company device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllCompanyDevices,
  getCompanyDeviceById,
  createCompanyDevice,
  updateCompanyDevice,
  assignCompanyDevice,
  unassignCompanyDevice,
  getEmployeeDeviceHistory,
  getDeviceTimeline,
  deleteCompanyDevice
};
