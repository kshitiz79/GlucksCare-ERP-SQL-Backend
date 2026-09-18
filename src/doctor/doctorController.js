const { isUUID, sanitizePayload, resolveHeadOfficeId, resolveAreaId, resolveClientGeneratedId } = require('../utils/sanitizer');

// Helper function to calculate MTD support value (business generated) for a list of doctors
const getSupportValueMtdMap = async (models, doctorIds) => {
  if (!doctorIds || doctorIds.length === 0) return {};
  
  const { Sale } = models;
  if (!Sale) return {};

  const { Op } = require('sequelize');
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  // Parse dates to date-only string format matching DB
  const startStr = startOfMonth.toISOString().split('T')[0];
  const endStr = endOfMonth.toISOString().split('T')[0];

  const sales = await Sale.findAll({
    where: {
      doctor_id: { [Op.in]: doctorIds },
      date: { [Op.between]: [startStr, endStr] }
    },
    attributes: ['doctor_id', 'amount'],
    raw: true
  });

  const mtdMap = {};
  doctorIds.forEach(id => {
    mtdMap[id] = 0.00;
  });

  sales.forEach(sale => {
    mtdMap[sale.doctor_id] = (mtdMap[sale.doctor_id] || 0) + Number(sale.amount || 0);
  });

  return mtdMap;
};

// Helper function to calculate YTD (current FY) support value for a list of doctors
const getSupportValueFyMap = async (models, doctorIds) => {
  if (!doctorIds || doctorIds.length === 0) return {};

  const { InvestmentRequest } = models;
  if (!InvestmentRequest) return {};

  const { Op } = require('sequelize');
  const now = new Date();
  let startYear = now.getFullYear();
  if (now.getMonth() < 3) { // Jan, Feb, Mar are 0, 1, 2
    startYear -= 1;
  }
  const startOfFY = new Date(startYear, 3, 1, 0, 0, 0, 0); // April 1st
  const endOfFY = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); // March 31st next year

  const approvedInvestments = await InvestmentRequest.findAll({
    where: {
      status: 'Approved',
      doctor_id: { [Op.in]: doctorIds },
      created_at: { [Op.between]: [startOfFY, endOfFY] }
    },
    attributes: ['doctor_id', 'payment_mode', 'amount', 'items'],
    raw: true
  });

  const fyMap = {};
  doctorIds.forEach(id => {
    fyMap[id] = 0.00;
  });

  approvedInvestments.forEach(inv => {
    let value = 0;
    if (inv.payment_mode === 'Items/Gift') {
      const itemsList = Array.isArray(inv.items) ? inv.items : [];
      value = itemsList.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.value || 0)), 0);
    } else {
      value = Number(inv.amount || 0);
    }
    fyMap[inv.doctor_id] = (fyMap[inv.doctor_id] || 0) + value;
  });

  return fyMap;
};

// GET all doctors
const getAllDoctors = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Doctor, HeadOffice, Area, DoctorVisit } = models;
    const doctors = await Doctor.findAll({
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'name']
        }
      ],
      distinct: true // This prevents duplicates when using includes
    });

    const doctorIds = doctors.map(d => d.id);
    const mtdMap = await getSupportValueMtdMap(models, doctorIds);
    const fyMap = await getSupportValueFyMap(models, doctorIds);

    // Fetch last visits by the logged-in user
    const lastVisits = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        user_id: req.user.id,
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitMap = {};
    lastVisits.forEach(v => {
      lastVisitMap[v.doctor_id] = v.last_visit_date;
    });

    // Fetch last visits by ANY user
    const lastVisitsAny = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitAnyMap = {};
    lastVisitsAny.forEach(v => {
      lastVisitAnyMap[v.doctor_id] = v.last_visit_date;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Transform the response to match the MongoDB format
    const transformedDoctors = doctors.map(doctor => {
      const doctorObj = doctor.toJSON();

      // Requesting user's last visit
      const lastVisitedDate = lastVisitMap[doctorObj.id] || null;
      let daysSinceLastVisit = null;
      if (lastVisitedDate) {
        const visitDate = new Date(lastVisitedDate);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisit = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      // Any user's last visit
      const lastVisitedDateAny = lastVisitAnyMap[doctorObj.id] || null;
      let daysSinceLastVisitAny = null;
      if (lastVisitedDateAny) {
        const visitDate = new Date(lastVisitedDateAny);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisitAny = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const {
        id,
        created_at,
        updated_at,
        headOfficeId,
        areaId,
        head_office_id,
        area_id,
        HeadOffice,
        Area,
        ...cleanDoctorObj
      } = doctorObj;

      return {
        ...cleanDoctorObj,
        support_value_mtd: mtdMap[doctorObj.id] || 0.00,
        support_value_ytd: fyMap[doctorObj.id] || 0.00,
        headOffice: doctorObj.HeadOffice || null,
        headOfficeId: doctorObj.headOfficeId || doctorObj.head_office_id || doctorObj.HeadOffice?.id || null,
        head_office_id: doctorObj.headOfficeId || doctorObj.head_office_id || doctorObj.HeadOffice?.id || null,
        area: doctorObj.Area || null,
        areaId: doctorObj.areaId || doctorObj.area_id || doctorObj.Area?.id || null,
        area_id: doctorObj.areaId || doctorObj.area_id || doctorObj.Area?.id || null,
        is_assigned_to_area: !!(doctorObj.areaId || doctorObj.area_id || doctorObj.Area?.id),
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
        geo_image_status: !!doctorObj.geo_image_url,

        // Visited stats (by current requesting user)
        lastVisitedDate: lastVisitedDate,
        daysSinceLastVisit: daysSinceLastVisit,

        // Visited stats (by any user)
        lastVisitedDateAny: lastVisitedDateAny,
        daysSinceLastVisitAny: daysSinceLastVisitAny
      };
    });

    res.json({
      success: true,
      count: transformedDoctors.length,
      data: transformedDoctors
    });
  } catch (error) {
    console.error('Error in getAllDoctors:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET doctor by ID
const getDoctorById = async (req, res) => {
  try {
    const { Doctor, HeadOffice, Area, DoctorVisit, User, Product } = req.app.get('models');
    const doctor = await Doctor.findByPk(req.params.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'name']
        }
      ]
    });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Fetch visits history for this doctor
    const visits = await DoctorVisit.findAll({
      where: { doctor_id: doctor.id },
      include: [
        {
          model: User,
          as: 'UserInfo',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Product,
          as: 'ProductInfo',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [['date', 'DESC'], ['created_at', 'DESC']]
    });

    const formattedVisits = visits.map(v => {
      const vObj = v.toJSON();
      return {
        id: vObj.id,
        date: vObj.date,
        notes: vObj.notes,
        latitude: vObj.latitude,
        longitude: vObj.longitude,
        confirmed: vObj.confirmed,
        remark: vObj.remark,
        products_detailed: vObj.products_detailed,
        gifts_given: vObj.gifts_given,
        userName: vObj.UserInfo ? vObj.UserInfo.name : 'Unknown',
        userEmail: vObj.UserInfo ? vObj.UserInfo.email : null,
        product: vObj.ProductInfo ? {
          id: vObj.ProductInfo.id,
          name: vObj.ProductInfo.name
        } : null,
        createdAt: vObj.created_at,
        updatedAt: vObj.updated_at
      };
    });

    // Transform the response to match the MongoDB format
    const doctorObj = doctor.toJSON();
    const {
      id,
      created_at,
      updated_at,
      headOfficeId,
      areaId,
      head_office_id,
      area_id,
      HeadOffice: hoDiscard,
      Area: areaDiscard,
      ...cleanDoctorObj
    } = doctorObj;

    const mtdMap = await getSupportValueMtdMap(req.app.get('models'), [doctorObj.id]);
    const fyMap = await getSupportValueFyMap(req.app.get('models'), [doctorObj.id]);
    const transformedDoctor = {
      ...cleanDoctorObj,
      support_value_mtd: mtdMap[doctorObj.id] || 0.00,
      support_value_ytd: fyMap[doctorObj.id] || 0.00,
      headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
      area: doctorObj.Area || null,
      is_assigned_to_area: !!doctorObj.areaId,
      _id: doctorObj.id,
      createdAt: doctorObj.created_at,
      updatedAt: doctorObj.updated_at,
      geo_image_status: !!doctorObj.geo_image_url,
      
      // Visit History
      visit_history: formattedVisits
    };

    res.json({
      success: true,
      data: transformedDoctor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new doctor
const createDoctor = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Doctor || !models.HeadOffice || !models.Area) {
      throw new Error('Required models are not available');
    }
    const { Doctor, HeadOffice, Area, DoctorChangeLog } = models;

    // Log the incoming request body for debugging
    console.log('Incoming doctor data:', JSON.stringify(req.body, null, 2));
    console.log('File uploaded:', req.file ? 'Yes' : 'No');

    // Process the incoming data
    let rawBody = req.body;
    if (typeof rawBody === 'string') {
      try {
        rawBody = JSON.parse(rawBody);
      } catch (e) {
        console.warn('Could not parse req.body string:', e.message);
      }
    }
    const sanitizedBody = sanitizePayload(rawBody?.data || rawBody) || {};
    const doctorData = { ...sanitizedBody };

    // Support clientGeneratedId for offline idempotency
    const clientGeneratedId = resolveClientGeneratedId(doctorData);

    if (clientGeneratedId) {
      const existingDoctor = await Doctor.findOne({
        where: { clientGeneratedId },
        include: [
          {
            model: HeadOffice,
            as: 'HeadOffice',
            attributes: ['id', 'name']
          },
          {
            model: Area,
            as: 'Area',
            attributes: ['id', 'name']
          }
        ]
      });

      if (existingDoctor) {
        console.log('Idempotency hit: Doctor with clientGeneratedId already exists:', clientGeneratedId);
        const doctorObj = existingDoctor.toJSON();
        const transformedDoctor = {
          ...doctorObj,
          id: doctorObj.id,
          _id: doctorObj.id,
          clientGeneratedId: doctorObj.clientGeneratedId || doctorObj.client_generated_id || clientGeneratedId,
          client_generated_id: doctorObj.clientGeneratedId || doctorObj.client_generated_id || clientGeneratedId,
          headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
          area: doctorObj.Area || null,
          is_assigned_to_area: !!doctorObj.areaId,
          createdAt: doctorObj.created_at,
          updatedAt: doctorObj.updated_at,
          HeadOffice: undefined,
          Area: undefined
        };
        return res.status(200).json({
          success: true,
          idempotent: true,
          data: transformedDoctor
        });
      }
      doctorData.clientGeneratedId = clientGeneratedId;
      delete doctorData.client_generated_id;
      delete doctorData.clientId;
      delete doctorData.client_id;
      delete doctorData.localId;
      delete doctorData.local_id;
    }

    // Handle head office ID field conversion (supports ligatures, headOfficeId, head_office_id, headOffice, head_office, user fallback)
    const resolvedHeadOfficeId = resolveHeadOfficeId(doctorData, req.user);
    doctorData.headOfficeId = resolvedHeadOfficeId;
    delete doctorData.head_office_id;
    delete doctorData.headOffice;
    delete doctorData.head_office;

    // Handle area ID field conversion (supports ligatures, areaId, area_id, area)
    const resolvedAreaId = resolveAreaId(doctorData);
    doctorData.areaId = resolvedAreaId;
    delete doctorData.area_id;
    delete doctorData.area;

    // Map created_by_name (frontend snake_case) → createdByName (model camelCase)
    if (doctorData.created_by_name) {
      doctorData.createdByName = doctorData.created_by_name;
      delete doctorData.created_by_name;
    }

    // Validate and set priority field
    if (doctorData.priority) {
      const priority = doctorData.priority.toUpperCase();
      if (!['A', 'B', 'C'].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Priority must be A, B, or C'
        });
      }
      doctorData.priority = priority;
    } else {
      // Default to 'C' if not provided
      doctorData.priority = 'C';
    }

    // Handle geo_image upload if file is provided
    if (req.file) {
      console.log('Processing geo_image upload...');
      const cloudinary = require('../config/cloudinary');

      try {
        const result = await new Promise((resolve, reject) => {
          const upload_stream = cloudinary.uploader.upload_stream(
            {
              folder: 'doctor_geo_images',
              resource_type: 'auto',
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto' }
              ]
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          upload_stream.end(req.file.buffer);
        });

        doctorData.geo_image_url = result.secure_url;
        console.log('Geo-image uploaded to Cloudinary:', result.secure_url);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Continue with doctor creation even if image upload fails
      }
    }

    // Log the processed data
    console.log('Processed doctor data:', JSON.stringify(doctorData, null, 2));

    // Validate that headOfficeId is provided
    if (!doctorData.headOfficeId) {
      return res.status(400).json({
        success: false,
        message: 'Head Office ID is required'
      });
    }

    // Validate that the headOffice actually exists in this database
    if (!isUUID(doctorData.headOfficeId)) {
      return res.status(400).json({
        success: false,
        message: `Head Office ID '${doctorData.headOfficeId}' is not a valid UUID format`
      });
    }

    const headOfficeRecord = await HeadOffice.findByPk(doctorData.headOfficeId);
    if (!headOfficeRecord) {
      return res.status(400).json({
        success: false,
        message: `Head Office with ID '${doctorData.headOfficeId}' does not exist`
      });
    }

    // Validate that the area exists if provided, otherwise gracefully fallback to null to avoid FK constraint error
    if (doctorData.areaId) {
      if (!isUUID(doctorData.areaId)) {
        console.warn(`⚠️ Warning: Area ID '${doctorData.areaId}' is not a valid UUID. Resetting areaId to null.`);
        doctorData.areaId = null;
      } else {
        const areaRecord = await Area.findByPk(doctorData.areaId);
        if (!areaRecord) {
          console.warn(`⚠️ Warning: Area '${doctorData.areaId}' does not exist in DB. Gracefully resetting areaId to null.`);
          doctorData.areaId = null;
        }
      }
    }

    // Compute monotonically increasing syncVersion
    let nextVersion = Date.now();
    try {
      const [seqRes] = await Doctor.sequelize.query("SELECT nextval('doctor_change_version_seq') AS ver;");
      if (seqRes && seqRes[0] && seqRes[0].ver) {
        nextVersion = Number(seqRes[0].ver);
      }
    } catch (e) {
      const maxV = await Doctor.max('syncVersion').catch(() => 1) || 1;
      nextVersion = Number(maxV) + 1;
    }
    doctorData.syncVersion = nextVersion;

    console.log('Creating doctor with data:', doctorData);
    const doctor = await Doctor.create(doctorData);
    console.log('Doctor created successfully:', doctor.id, 'syncVersion:', nextVersion);

    // Record change log for sync
    try {
      if (DoctorChangeLog) {
        await DoctorChangeLog.create({
          doctorId: doctor.id,
          changeVersion: nextVersion,
          operation: 'CREATE',
          headOfficeId: doctor.headOfficeId,
          areaId: doctor.areaId || null,
          snapshot: {
            id: doctor.id,
            name: doctor.name,
            headOfficeId: doctor.headOfficeId,
            areaId: doctor.areaId,
            syncVersion: nextVersion
          }
        });
      }
    } catch (logErr) {
      console.warn('⚠️ Warning: Failed to create DoctorChangeLog on create:', logErr.message);
    }

    // Fetch the created doctor with associations
    const createdDoctor = await Doctor.findByPk(doctor.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'name']
        }
      ]
    });

    // Transform the response to match the MongoDB format
    const doctorObj = createdDoctor.toJSON();
    const transformedDoctor = {
      ...doctorObj,
      id: doctorObj.id,
      _id: doctorObj.id,
      clientGeneratedId: doctorObj.clientGeneratedId || doctorObj.client_generated_id || null,
      client_generated_id: doctorObj.clientGeneratedId || doctorObj.client_generated_id || null,
      headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
      area: doctorObj.Area || null,
      is_assigned_to_area: !!doctorObj.areaId,
      createdAt: doctorObj.created_at,
      updatedAt: doctorObj.updated_at,
      // Remove the nested objects
      HeadOffice: undefined,
      Area: undefined
    };

    // Auto-create notification for Admin users about new doctor creation
    try {
      const { Notification, NotificationRecipient, User } = models;
      if (Notification && NotificationRecipient && User) {
        const adminUsers = await User.findAll({
          where: { role: ['Super Admin', 'Admin'], is_active: true },
          attributes: ['id']
        });
        if (adminUsers && adminUsers.length > 0) {
          const notif = await Notification.create({
            title: 'New Doctor Added',
            body: `A new doctor "${doctorData.name}" has been registered in the system.`,
            sender_id: req.user?.id || adminUsers[0].id,
            is_broadcast: false
          });
          const recipients = adminUsers.map(u => ({
            notification_id: notif.id,
            user_id: u.id,
            is_read: false
          }));
          await NotificationRecipient.bulkCreate(recipients);
        }
      }
    } catch (notifErr) {
      console.error('Error notifying admins about new doctor:', notifErr);
    }

    res.status(201).json({
      success: true,
      data: transformedDoctor
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a doctor
const updateDoctor = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Doctor || !models.HeadOffice || !models.Area) {
      throw new Error('Required models are not available');
    }
    const { Doctor, HeadOffice, Area, DoctorChangeLog, DoctorEditRequest, Notification, NotificationRecipient, User } = models;

    const doctor = await Doctor.findByPk(req.params.id, {
      include: [
        { model: HeadOffice, as: 'HeadOffice', attributes: ['id', 'name'] },
        { model: Area, as: 'Area', attributes: ['id', 'name'] }
      ]
    });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Determine if requester is an Admin or Super Admin
    const userRole = req.user?.role || '';
    const isAdmin = ['Admin', 'Super Admin'].includes(userRole) || (typeof userRole === 'string' && userRole.toLowerCase().includes('admin'));

    // Handle geo_image upload if file is provided
    let uploadedImageUrl = null;
    if (req.file) {
      console.log('Processing geo_image upload for update...');
      const cloudinary = require('../config/cloudinary');

      try {
        const result = await new Promise((resolve, reject) => {
          const upload_stream = cloudinary.uploader.upload_stream(
            {
              folder: 'doctor_geo_images',
              resource_type: 'auto',
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto' }
              ]
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          upload_stream.end(req.file.buffer);
        });

        uploadedImageUrl = result.secure_url;
        console.log('Geo-image uploaded to Cloudinary:', result.secure_url);
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
      }
    }

    // Map headOffice and area inputs to the camelCase attributes used in Doctor model definition
    const sanitizedBody = sanitizePayload(req.body) || {};
    const doctorData = { ...sanitizedBody };
    delete doctorData.baseServerVersion;
    delete doctorData.base_server_version;

    if (uploadedImageUrl) {
      doctorData.geo_image_url = uploadedImageUrl;
    }

    const resolvedHeadOfficeId = resolveHeadOfficeId(doctorData);
    if (resolvedHeadOfficeId) {
      doctorData.headOfficeId = resolvedHeadOfficeId;
      delete doctorData.head_office_id;
      delete doctorData.headOffice;
      delete doctorData.head_office;
    }

    const resolvedAreaId = resolveAreaId(doctorData);
    if (resolvedAreaId !== null && resolvedAreaId !== undefined) {
      doctorData.areaId = resolvedAreaId;
      delete doctorData.area_id;
      delete doctorData.area;
    }

    // Validate and set priority field if provided
    if (doctorData.priority) {
      const priority = doctorData.priority.toUpperCase();
      if (!['A', 'B', 'C'].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Priority must be A, B, or C'
        });
      }
      doctorData.priority = priority;
    }

    // Handle camelCase to snake_case conversion for database columns
    const convertedData = {};
    Object.keys(doctorData).forEach(key => {
      if (key === 'headOfficeId' || key === 'areaId' || key === 'clientGeneratedId') {
        convertedData[key] = doctorData[key];
      } else {
        const snakeCaseKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        convertedData[snakeCaseKey] = doctorData[key];
      }
    });

    // Validate headOfficeId and areaId existence
    if (convertedData.headOfficeId) {
      if (!isUUID(convertedData.headOfficeId)) {
        return res.status(400).json({
          success: false,
          message: `Head Office ID '${convertedData.headOfficeId}' is not a valid UUID format`
        });
      }
      const hoExists = await HeadOffice.findByPk(convertedData.headOfficeId);
      if (!hoExists) {
        return res.status(400).json({
          success: false,
          message: `Head Office with ID '${convertedData.headOfficeId}' does not exist`
        });
      }
    }

    if (convertedData.areaId) {
      if (!isUUID(convertedData.areaId)) {
        console.warn(`⚠️ Warning: Area ID '${convertedData.areaId}' is not a valid UUID. Resetting areaId to null.`);
        convertedData.areaId = null;
      } else {
        const areaExists = await Area.findByPk(convertedData.areaId);
        if (!areaExists) {
          console.warn(`⚠️ Warning: Area '${convertedData.areaId}' does not exist. Gracefully resetting areaId to null.`);
          convertedData.areaId = null;
        }
      }
    }

    // =========================================================================
    // NON-ADMIN ROLE CHECK: Create DoctorEditRequest instead of direct DB update
    // =========================================================================
    if (!isAdmin) {
      console.log(`[Doctor Edit Request] User ${req.user.name} (${req.user.role}) requested edit for Doctor ${doctor.name} (${doctor.id})`);

      const currentDoctorJson = doctor.toJSON();
      const currentSnapshot = {
        name: currentDoctorJson.name,
        specialization: currentDoctorJson.specialization,
        clinic_name: currentDoctorJson.clinic_name,
        clinic_address: currentDoctorJson.clinic_address,
        location: currentDoctorJson.location,
        latitude: currentDoctorJson.latitude,
        longitude: currentDoctorJson.longitude,
        email: currentDoctorJson.email,
        phone: currentDoctorJson.phone,
        registration_number: currentDoctorJson.registration_number,
        years_of_experience: currentDoctorJson.years_of_experience,
        date_of_birth: currentDoctorJson.date_of_birth,
        gender: currentDoctorJson.gender,
        anniversary: currentDoctorJson.anniversary,
        priority: currentDoctorJson.priority,
        qualification: currentDoctorJson.qualification,
        consultation_fee: currentDoctorJson.consultation_fee,
        available_timings: currentDoctorJson.available_timings,
        head_office_id: currentDoctorJson.headOfficeId || currentDoctorJson.head_office_id,
        headOfficeName: currentDoctorJson.HeadOffice ? currentDoctorJson.HeadOffice.name : null,
        area_id: currentDoctorJson.areaId || currentDoctorJson.area_id,
        areaName: currentDoctorJson.Area ? currentDoctorJson.Area.name : null,
        geo_image_url: currentDoctorJson.geo_image_url
      };

      // Check for existing pending request by this user for this doctor
      let editRequest = null;
      if (DoctorEditRequest) {
        const existingPending = await DoctorEditRequest.findOne({
          where: {
            doctor_id: doctor.id,
            user_id: req.user.id,
            status: 'Pending'
          }
        });

        if (existingPending) {
          await existingPending.update({
            proposed_changes: convertedData,
            current_data: currentSnapshot,
            head_office_id: convertedData.headOfficeId || doctor.headOfficeId,
            category: 'doctor',
            entity_id: doctor.id
          });
          editRequest = existingPending;
        } else {
          editRequest = await DoctorEditRequest.create({
            category: 'doctor',
            entity_id: doctor.id,
            doctor_id: doctor.id,
            user_id: req.user.id,
            head_office_id: convertedData.headOfficeId || doctor.headOfficeId,
            current_data: currentSnapshot,
            proposed_changes: convertedData,
            status: 'Pending'
          });
        }
      }

      // Send notification to Admin users
      try {
        if (Notification && NotificationRecipient && User) {
          const adminUsers = await User.findAll({
            where: { role: ['Super Admin', 'Admin'], is_active: true },
            attributes: ['id']
          });
          if (adminUsers && adminUsers.length > 0) {
            const notif = await Notification.create({
              title: 'Doctor Edit Request',
              body: `${req.user.name || 'User'} (${req.user.role || 'MR'}) requested changes for Doctor "${doctor.name}". Please review and approve.`,
              sender_id: req.user.id,
              is_broadcast: false
            });
            const recipients = adminUsers.map(u => ({
              notification_id: notif.id,
              user_id: u.id,
              is_read: false
            }));
            await NotificationRecipient.bulkCreate(recipients);
          }
        }
      } catch (notifErr) {
        console.warn('⚠️ Notification error on doctor edit request:', notifErr.message);
      }

      return res.status(200).json({
        success: true,
        approvalRequired: true,
        message: 'Doctor edit request submitted to Admin for approval. Changes will be applied once approved.',
        data: editRequest || { doctor_id: doctor.id, status: 'Pending' }
      });
    }

    // =========================================================================
    // ADMIN / SUPER ADMIN: Direct update into database
    // =========================================================================
    // Optimistic Concurrency Check (baseServerVersion)
    const baseServerVersion = req.body.baseServerVersion !== undefined
      ? req.body.baseServerVersion
      : (req.body.base_server_version !== undefined ? req.body.base_server_version : req.headers['x-base-server-version']);

    if (baseServerVersion !== undefined && baseServerVersion !== null && baseServerVersion !== '') {
      const currentVersion = Number(doctor.syncVersion || doctor.sync_version || 1);
      if (currentVersion > Number(baseServerVersion)) {
        console.warn(`[Sync Conflict] Doctor ${doctor.id} server version ${currentVersion} > client base ${baseServerVersion}`);
        return res.status(409).json({
          success: false,
          conflict: true,
          message: 'Conflict detected: Doctor record has been modified by another client or server update.',
          serverVersion: currentVersion,
          data: doctor
        });
      }
    }

    // Compute next monotonic version
    let nextVersion = Date.now();
    try {
      const [seqRes] = await Doctor.sequelize.query("SELECT nextval('doctor_change_version_seq') AS ver;");
      if (seqRes && seqRes[0] && seqRes[0].ver) {
        nextVersion = Number(seqRes[0].ver);
      }
    } catch (e) {
      nextVersion = (Number(doctor.syncVersion || doctor.sync_version) || 1) + 1;
    }
    convertedData.sync_version = nextVersion;

    await doctor.update(convertedData);

    // Record change log for sync
    try {
      if (DoctorChangeLog) {
        await DoctorChangeLog.create({
          doctorId: doctor.id,
          changeVersion: nextVersion,
          operation: 'UPDATE',
          headOfficeId: doctor.headOfficeId,
          areaId: doctor.areaId || null,
          snapshot: {
            id: doctor.id,
            name: doctor.name,
            headOfficeId: doctor.headOfficeId,
            areaId: doctor.areaId,
            syncVersion: nextVersion
          }
        });
      }
    } catch (logErr) {
      console.warn('⚠️ Warning: Failed to create DoctorChangeLog on update:', logErr.message);
    }

    // Fetch the updated doctor with associations
    const updatedDoctor = await Doctor.findByPk(doctor.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'name']
        }
      ]
    });

    // Transform the response to match the MongoDB format
    const doctorObj = updatedDoctor.toJSON();
    const transformedDoctor = {
      ...doctorObj,
      id: doctorObj.id,
      _id: doctorObj.id,
      clientGeneratedId: doctorObj.clientGeneratedId || doctorObj.client_generated_id || null,
      client_generated_id: doctorObj.clientGeneratedId || doctorObj.client_generated_id || null,
      headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
      area: doctorObj.Area || null,
      is_assigned_to_area: !!doctorObj.areaId,
      createdAt: doctorObj.created_at,
      updatedAt: doctorObj.updated_at,
      HeadOffice: undefined,
      Area: undefined
    };

    res.json({
      success: true,
      direct: true,
      message: 'Doctor updated successfully',
      data: transformedDoctor
    });
  } catch (error) {
    console.error('Error in updateDoctor:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ASSIGN / UNASSIGN Area to Doctor (Single or Bulk)
const assignAreaToDoctor = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Doctor || !models.Area) {
      throw new Error('Required models are not available');
    }
    const { Doctor, HeadOffice, Area, DoctorChangeLog } = models;

    const sanitizedBody = sanitizePayload(req.body) || {};
    const targetDoctorId = req.params.id || sanitizedBody.doctorId || sanitizedBody.doctor_id || sanitizedBody.id;
    const targetDoctorIds = sanitizedBody.doctorIds || sanitizedBody.doctor_ids;

    // Resolve areaId from body (supports areaId, area_id, area)
    const resolvedAreaId = resolveAreaId(sanitizedBody);
    let areaRecord = null;

    if (resolvedAreaId) {
      if (!isUUID(resolvedAreaId)) {
        return res.status(400).json({
          success: false,
          message: `Area ID '${resolvedAreaId}' is not a valid UUID format`
        });
      }
      areaRecord = await Area.findByPk(resolvedAreaId);
      if (!areaRecord) {
        return res.status(404).json({
          success: false,
          message: `Area with ID '${resolvedAreaId}' does not exist`
        });
      }
    }

    const finalAreaId = areaRecord ? areaRecord.id : null;

    // Bulk doctor assignment if array provided
    if (Array.isArray(targetDoctorIds) && targetDoctorIds.length > 0) {
      const doctors = await Doctor.findAll({
        where: { id: { [require('sequelize').Op.in]: targetDoctorIds } }
      });

      if (doctors.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No doctors found matching the provided IDs'
        });
      }

      let nextVersion = Date.now();
      try {
        const [seqRes] = await Doctor.sequelize.query("SELECT nextval('doctor_change_version_seq') AS ver;");
        if (seqRes && seqRes[0] && seqRes[0].ver) {
          nextVersion = Number(seqRes[0].ver);
        }
      } catch (e) {
        nextVersion = Date.now();
      }

      await Doctor.update(
        { areaId: finalAreaId, sync_version: nextVersion },
        { where: { id: { [require('sequelize').Op.in]: targetDoctorIds } } }
      );

      // Track in change logs for sync
      if (DoctorChangeLog) {
        try {
          const logs = doctors.map(d => ({
            doctorId: d.id,
            changeVersion: nextVersion,
            operation: 'UPDATE',
            headOfficeId: d.headOfficeId,
            areaId: finalAreaId,
            snapshot: {
              id: d.id,
              name: d.name,
              headOfficeId: d.headOfficeId,
              areaId: finalAreaId,
              syncVersion: nextVersion
            }
          }));
          await DoctorChangeLog.bulkCreate(logs);
        } catch (logErr) {
          console.warn('⚠️ Warning: Failed to create DoctorChangeLog on bulk assign area:', logErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: finalAreaId ? `Assigned area '${areaRecord.name}' to ${doctors.length} doctor(s)` : `Unassigned area from ${doctors.length} doctor(s)`,
        count: doctors.length,
        areaId: finalAreaId,
        areaName: areaRecord ? areaRecord.name : null
      });
    }

    // Single doctor assignment
    if (!targetDoctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required (in URL :id or body doctorId)'
      });
    }

    let doctor = null;
    if (isUUID(targetDoctorId)) {
      doctor = await Doctor.findByPk(targetDoctorId);
    }
    if (!doctor) {
      doctor = await Doctor.findOne({
        where: { clientGeneratedId: targetDoctorId }
      });
    }

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: `Doctor with ID '${targetDoctorId}' not found`
      });
    }

    // Compute monotonic syncVersion
    let nextVersion = Date.now();
    try {
      const [seqRes] = await Doctor.sequelize.query("SELECT nextval('doctor_change_version_seq') AS ver;");
      if (seqRes && seqRes[0] && seqRes[0].ver) {
        nextVersion = Number(seqRes[0].ver);
      }
    } catch (e) {
      nextVersion = (Number(doctor.syncVersion || doctor.sync_version) || 1) + 1;
    }

    await doctor.update({
      areaId: finalAreaId,
      sync_version: nextVersion
    });

    // Record change log for sync
    if (DoctorChangeLog) {
      try {
        await DoctorChangeLog.create({
          doctorId: doctor.id,
          changeVersion: nextVersion,
          operation: 'UPDATE',
          headOfficeId: doctor.headOfficeId,
          areaId: finalAreaId,
          snapshot: {
            id: doctor.id,
            name: doctor.name,
            headOfficeId: doctor.headOfficeId,
            areaId: finalAreaId,
            syncVersion: nextVersion
          }
        });
      } catch (logErr) {
        console.warn('⚠️ Warning: Failed to create DoctorChangeLog on assign area:', logErr.message);
      }
    }

    // Fetch updated doctor with associations
    const updatedDoctor = await Doctor.findByPk(doctor.id, {
      include: [
        { model: HeadOffice, as: 'HeadOffice', attributes: ['id', 'name'] },
        { model: Area, as: 'Area', attributes: ['id', 'name'] }
      ]
    });

    const doctorObj = updatedDoctor.toJSON();
    const transformedDoctor = {
      ...doctorObj,
      id: doctorObj.id,
      _id: doctorObj.id,
      clientGeneratedId: doctorObj.clientGeneratedId || doctorObj.client_generated_id || null,
      client_generated_id: doctorObj.clientGeneratedId || doctorObj.client_generated_id || null,
      headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
      area: doctorObj.Area || null,
      is_assigned_to_area: !!doctorObj.areaId,
      createdAt: doctorObj.created_at,
      updatedAt: doctorObj.updated_at,
      HeadOffice: undefined,
      Area: undefined
    };

    res.status(200).json({
      success: true,
      message: finalAreaId ? `Area '${areaRecord.name}' assigned to Doctor '${doctor.name}' successfully` : `Area unassigned from Doctor '${doctor.name}' successfully`,
      data: transformedDoctor
    });
  } catch (error) {
    console.error('Error in assignAreaToDoctor:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET all edit requests (Universal: Doctor / Chemist / Stockist) (Admin / Requester)
const getDoctorEditRequests = async (req, res) => {
  try {
    const { DoctorEditRequest, Doctor, Chemist, Stockist, User, HeadOffice, Area } = req.app.get('models');
    if (!DoctorEditRequest) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const userRole = req.user?.role || '';
    const isAdmin = ['Admin', 'Super Admin'].includes(userRole) || (typeof userRole === 'string' && userRole.toLowerCase().includes('admin'));

    const { status, doctorId, chemistId, stockistId, category } = req.query;
    const whereClause = {};

    if (status && status !== 'all') {
      whereClause.status = status;
    }
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    if (doctorId) {
      whereClause.doctor_id = doctorId;
    }
    if (chemistId) {
      whereClause.chemist_id = chemistId;
    }
    if (stockistId) {
      whereClause.stockist_id = stockistId;
    }
    if (!isAdmin) {
      whereClause.user_id = req.user.id;
    }

    const includeModels = [];
    if (Doctor) {
      includeModels.push({
        model: Doctor,
        as: 'doctor',
        required: false,
        include: [
          ...(HeadOffice ? [{ model: HeadOffice, as: 'HeadOffice', attributes: ['id', 'name'] }] : []),
          ...(Area ? [{ model: Area, as: 'Area', attributes: ['id', 'name'] }] : [])
        ]
      });
    }
    if (Chemist) {
      includeModels.push({
        model: Chemist,
        as: 'chemist',
        required: false,
        include: [
          ...(HeadOffice ? [{ model: HeadOffice, as: 'HeadOffice', attributes: ['id', 'name'] }] : []),
          ...(Area ? [{ model: Area, as: 'Area', attributes: ['id', 'name'] }] : [])
        ]
      });
    }
    if (Stockist) {
      includeModels.push({
        model: Stockist,
        as: 'stockist',
        required: false,
        include: [
          ...(HeadOffice ? [{ model: HeadOffice, as: 'HeadOffice', attributes: ['id', 'name'] }] : []),
          ...(Area ? [{ model: Area, as: 'Area', attributes: ['id', 'name'] }] : [])
        ]
      });
    }
    if (User) {
      includeModels.push(
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'name', 'email', 'role', 'phone', 'employee_code']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'name', 'email', 'role']
        }
      );
    }
    if (HeadOffice) {
      includeModels.push({
        model: HeadOffice,
        as: 'headOffice',
        attributes: ['id', 'name']
      });
    }

    const requests = await DoctorEditRequest.findAll({
      where: whereClause,
      include: includeModels,
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error in getDoctorEditRequests:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// APPROVE an edit request (Doctor / Chemist / Stockist) (Admin Only)
const approveDoctorEditRequest = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { DoctorEditRequest, Doctor, Chemist, ChemistAnnualTurnover, Stockist, StockistAnnualTurnover, HeadOffice, Area, DoctorChangeLog, Notification, NotificationRecipient } = models;

    const userRole = req.user?.role || '';
    const isAdmin = ['Admin', 'Super Admin'].includes(userRole) || (typeof userRole === 'string' && userRole.toLowerCase().includes('admin'));

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Admins can approve edit requests'
      });
    }

    const includeModels = [];
    if (Doctor) includeModels.push({ model: Doctor, as: 'doctor', required: false });
    if (Chemist) includeModels.push({ model: Chemist, as: 'chemist', required: false });
    if (Stockist) includeModels.push({ model: Stockist, as: 'stockist', required: false });

    const editRequest = await DoctorEditRequest.findByPk(req.params.id, {
      include: includeModels
    });

    if (!editRequest) {
      return res.status(404).json({
        success: false,
        message: 'Edit request not found'
      });
    }

    if (editRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This edit request is already ${editRequest.status.toLowerCase()}`
      });
    }

    const category = editRequest.category || 'doctor';
    let entityName = '';
    const proposedChanges = editRequest.proposed_changes || {};

    if (category === 'doctor') {
      const doctor = await Doctor.findByPk(editRequest.doctor_id || editRequest.entity_id);
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Associated doctor not found'
        });
      }
      entityName = doctor.name;
      const updatePayload = { ...proposedChanges };

      let nextVersion = Date.now();
      try {
        const [seqRes] = await Doctor.sequelize.query("SELECT nextval('doctor_change_version_seq') AS ver;");
        if (seqRes && seqRes[0] && seqRes[0].ver) {
          nextVersion = Number(seqRes[0].ver);
        }
      } catch (e) {
        nextVersion = (Number(doctor.syncVersion || doctor.sync_version) || 1) + 1;
      }
      updatePayload.sync_version = nextVersion;
      await doctor.update(updatePayload);

      try {
        if (DoctorChangeLog) {
          await DoctorChangeLog.create({
            doctorId: doctor.id,
            changeVersion: nextVersion,
            operation: 'UPDATE',
            headOfficeId: doctor.headOfficeId,
            areaId: doctor.areaId || null,
            snapshot: {
              id: doctor.id,
              name: doctor.name,
              headOfficeId: doctor.headOfficeId,
              areaId: doctor.areaId,
              syncVersion: nextVersion
            }
          });
        }
      } catch (logErr) {
        console.warn('⚠️ Warning: Failed to create DoctorChangeLog on approval:', logErr.message);
      }
    } else if (category === 'chemist') {
      const chemist = await Chemist.findByPk(editRequest.chemist_id || editRequest.entity_id);
      if (!chemist) {
        return res.status(404).json({
          success: false,
          message: 'Associated chemist not found'
        });
      }
      entityName = chemist.firm_name;
      const { annualTurnover, ...chemistFields } = proposedChanges;
      await chemist.update(chemistFields);

      if (annualTurnover && Array.isArray(annualTurnover) && ChemistAnnualTurnover) {
        await ChemistAnnualTurnover.destroy({ where: { chemist_id: chemist.id } });
        const turnoverRecords = annualTurnover.map(t => ({
          chemist_id: chemist.id,
          year: parseInt(t.year, 10),
          amount: parseFloat(t.amount)
        })).filter(t => !isNaN(t.year) && !isNaN(t.amount));
        if (turnoverRecords.length > 0) {
          await ChemistAnnualTurnover.bulkCreate(turnoverRecords);
        }
      }
    } else if (category === 'stockist') {
      const stockist = await Stockist.findByPk(editRequest.stockist_id || editRequest.entity_id);
      if (!stockist) {
        return res.status(404).json({
          success: false,
          message: 'Associated stockist not found'
        });
      }
      entityName = stockist.firm_name;
      const { annualTurnover, ...stockistFields } = proposedChanges;
      await stockist.update(stockistFields);

      if (annualTurnover && Array.isArray(annualTurnover) && StockistAnnualTurnover) {
        await StockistAnnualTurnover.destroy({ where: { stockist_id: stockist.id } });
        const turnoverRecords = annualTurnover.map(t => ({
          stockist_id: stockist.id,
          year: parseInt(t.year, 10),
          amount: parseFloat(t.amount)
        })).filter(t => !isNaN(t.year) && !isNaN(t.amount));
        if (turnoverRecords.length > 0) {
          await StockistAnnualTurnover.bulkCreate(turnoverRecords);
        }
      }
    }

    // Mark edit request as Approved
    const adminNotes = req.body.comments || req.body.admin_notes || null;
    await editRequest.update({
      status: 'Approved',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      admin_notes: adminNotes
    });

    // Notify the user who requested the edit
    try {
      if (Notification && NotificationRecipient && editRequest.user_id) {
        const typeLabel = category.charAt(0).toUpperCase() + category.slice(1);
        const notif = await Notification.create({
          title: `${typeLabel} Edit Request Approved`,
          body: `Your edit request for ${typeLabel} "${entityName}" has been approved by ${req.user.name || 'Admin'}. Changes are now live.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
          sender_id: req.user.id,
          is_broadcast: false
        });
        await NotificationRecipient.create({
          notification_id: notif.id,
          user_id: editRequest.user_id,
          is_read: false
        });
      }
    } catch (notifErr) {
      console.warn('⚠️ Notification error on request approval:', notifErr.message);
    }

    res.json({
      success: true,
      message: `${category.charAt(0).toUpperCase() + category.slice(1)} edit request for "${entityName}" approved successfully`,
      editRequest
    });
  } catch (error) {
    console.error('Error in approveDoctorEditRequest:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// REJECT an edit request (Doctor / Chemist / Stockist) (Admin Only)
const rejectDoctorEditRequest = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { DoctorEditRequest, Doctor, Chemist, Stockist, Notification, NotificationRecipient } = models;

    const userRole = req.user?.role || '';
    const isAdmin = ['Admin', 'Super Admin'].includes(userRole) || (typeof userRole === 'string' && userRole.toLowerCase().includes('admin'));

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Admins can reject edit requests'
      });
    }

    const includeModels = [];
    if (Doctor) includeModels.push({ model: Doctor, as: 'doctor', required: false });
    if (Chemist) includeModels.push({ model: Chemist, as: 'chemist', required: false });
    if (Stockist) includeModels.push({ model: Stockist, as: 'stockist', required: false });

    const editRequest = await DoctorEditRequest.findByPk(req.params.id, {
      include: includeModels
    });

    if (!editRequest) {
      return res.status(404).json({
        success: false,
        message: 'Edit request not found'
      });
    }

    if (editRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `This edit request is already ${editRequest.status.toLowerCase()}`
      });
    }

    const category = editRequest.category || 'doctor';
    let entityName = '';
    if (category === 'doctor') {
      entityName = editRequest.doctor?.name || editRequest.current_data?.name || 'Doctor';
    } else if (category === 'chemist') {
      entityName = editRequest.chemist?.firm_name || editRequest.current_data?.firm_name || 'Chemist';
    } else if (category === 'stockist') {
      entityName = editRequest.stockist?.firm_name || editRequest.current_data?.firm_name || 'Stockist';
    }

    const adminNotes = req.body.comments || req.body.admin_notes || req.body.reason || 'Rejected by Admin';
    await editRequest.update({
      status: 'Rejected',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      admin_notes: adminNotes
    });

    // Notify requester
    try {
      if (Notification && NotificationRecipient && editRequest.user_id) {
        const typeLabel = category.charAt(0).toUpperCase() + category.slice(1);
        const notif = await Notification.create({
          title: `${typeLabel} Edit Request Rejected`,
          body: `Your edit request for ${typeLabel} "${entityName}" was rejected by ${req.user.name || 'Admin'}.${adminNotes ? ` Reason: ${adminNotes}` : ''}`,
          sender_id: req.user.id,
          is_broadcast: false
        });
        await NotificationRecipient.create({
          notification_id: notif.id,
          user_id: editRequest.user_id,
          is_read: false
        });
      }
    } catch (notifErr) {
      console.warn('⚠️ Notification error on request rejection:', notifErr.message);
    }

    res.json({
      success: true,
      message: `${category.charAt(0).toUpperCase() + category.slice(1)} edit request rejected successfully`,
      data: editRequest
    });
  } catch (error) {
    console.error('Error in rejectDoctorEditRequest:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a doctor
const deleteDoctor = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Doctor, DoctorChangeLog } = models;
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Compute next version for tombstone
    let nextVersion = Date.now();
    try {
      const [seqRes] = await Doctor.sequelize.query("SELECT nextval('doctor_change_version_seq') AS ver;");
      if (seqRes && seqRes[0] && seqRes[0].ver) {
        nextVersion = Number(seqRes[0].ver);
      }
    } catch (e) {}

    // Record tombstone change log before deleting
    try {
      if (DoctorChangeLog) {
        await DoctorChangeLog.create({
          doctorId: doctor.id,
          changeVersion: nextVersion,
          operation: 'DELETE',
          headOfficeId: doctor.headOfficeId,
          areaId: doctor.areaId || null,
          snapshot: {
            id: doctor.id,
            name: doctor.name,
            headOfficeId: doctor.headOfficeId,
            deletedAt: new Date()
          }
        });
      }
    } catch (logErr) {
      console.warn('⚠️ Warning: Failed to create DoctorChangeLog on delete:', logErr.message);
    }

    await doctor.destroy();
    res.json({
      success: true,
      message: 'Doctor deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET doctors by head office ID
const getDoctorsByHeadOffice = async (req, res) => {
  try {
    const { Doctor, HeadOffice, Area, DoctorVisit } = req.app.get('models');
    const { headOfficeId } = req.params;
    const doctors = await Doctor.findAll({
      where: {
        headOfficeId: headOfficeId
      },
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'name']
        }
      ],
      distinct: true,

    });

    const doctorIds = doctors.map(d => d.id);
    const mtdMap = await getSupportValueMtdMap(req.app.get('models'), doctorIds);
    const fyMap = await getSupportValueFyMap(req.app.get('models'), doctorIds);

    // Fetch last visits by the logged-in user
    const lastVisits = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        user_id: req.user.id,
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitMap = {};
    lastVisits.forEach(v => {
      lastVisitMap[v.doctor_id] = v.last_visit_date;
    });

    // Fetch last visits by ANY user
    const lastVisitsAny = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitAnyMap = {};
    lastVisitsAny.forEach(v => {
      lastVisitAnyMap[v.doctor_id] = v.last_visit_date;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Transform the response to match the MongoDB format
    const transformedDoctors = doctors.map(doctor => {
      const doctorObj = doctor.toJSON();

      // Requesting user's last visit
      const lastVisitedDate = lastVisitMap[doctorObj.id] || null;
      let daysSinceLastVisit = null;
      if (lastVisitedDate) {
        const visitDate = new Date(lastVisitedDate);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisit = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      // Any user's last visit
      const lastVisitedDateAny = lastVisitAnyMap[doctorObj.id] || null;
      let daysSinceLastVisitAny = null;
      if (lastVisitedDateAny) {
        const visitDate = new Date(lastVisitedDateAny);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisitAny = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const {
        id,
        created_at,
        updated_at,
        headOfficeId,
        areaId,
        head_office_id,
        area_id,
        HeadOffice,
        Area,
        ...cleanDoctorObj
      } = doctorObj;

      return {
        ...cleanDoctorObj,
        support_value_mtd: mtdMap[doctorObj.id] || 0.00,
        support_value_ytd: fyMap[doctorObj.id] || 0.00,
        headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
        area: doctorObj.Area || null,
        is_assigned_to_area: !!doctorObj.areaId,
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
        geo_image_status: !!doctorObj.geo_image_url,

        // Visited stats (by current requesting user)
        lastVisitedDate: lastVisitedDate,
        daysSinceLastVisit: daysSinceLastVisit,

        // Visited stats (by any user)
        lastVisitedDateAny: lastVisitedDateAny,
        daysSinceLastVisitAny: daysSinceLastVisitAny
      };
    });

    res.json({
      success: true,
      count: transformedDoctors.length,
      data: transformedDoctors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET doctors for current user's head offices
const getMyDoctors = async (req, res) => {
  try {
    const { Doctor, HeadOffice, User, Area, DoctorVisit } = req.app.get('models');

    // Get the current user with their head offices
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] }
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all user's head office IDs
    const officeIds = new Set();
    if (user.head_office_id) {
      officeIds.add(user.head_office_id);
    }
    if (user.headOffices && user.headOffices.length > 0) {
      user.headOffices.forEach(office => officeIds.add(office.id));
    }
    const { UserHeadOffice } = req.app.get('models');
    if (UserHeadOffice) {
      const uhoList = await UserHeadOffice.findAll({
        where: { user_id: user.id },
        attributes: ['head_office_id'],
        raw: true
      }).catch(() => []);
      uhoList.forEach(u => {
        if (u.head_office_id) officeIds.add(u.head_office_id);
      });
    }

    const headOfficeIds = Array.from(officeIds);

    if (headOfficeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No head office assigned to your account. Please contact an administrator.'
      });
    }

    // Find all doctors assigned to user's head offices
    const doctors = await Doctor.findAll({
      where: {
        headOfficeId: { [require('sequelize').Op.in]: headOfficeIds }
      },
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'name']
        }
      ],

      distinct: true // This prevents duplicates when using includes
    });

    const doctorIds = doctors.map(d => d.id);
    const mtdMap = await getSupportValueMtdMap(req.app.get('models'), doctorIds);
    const fyMap = await getSupportValueFyMap(req.app.get('models'), doctorIds);

    // Fetch last visits by the logged-in user
    const lastVisits = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        user_id: req.user.id,
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitMap = {};
    lastVisits.forEach(v => {
      lastVisitMap[v.doctor_id] = v.last_visit_date;
    });

    // Fetch last visits by ANY user
    const lastVisitsAny = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitAnyMap = {};
    lastVisitsAny.forEach(v => {
      lastVisitAnyMap[v.doctor_id] = v.last_visit_date;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Transform the response to match the MongoDB format
    const transformedDoctors = doctors.map(doctor => {
      const doctorObj = doctor.toJSON();

      // Requesting user's last visit
      const lastVisitedDate = lastVisitMap[doctorObj.id] || null;
      let daysSinceLastVisit = null;
      if (lastVisitedDate) {
        const visitDate = new Date(lastVisitedDate);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisit = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      // Any user's last visit
      const lastVisitedDateAny = lastVisitAnyMap[doctorObj.id] || null;
      let daysSinceLastVisitAny = null;
      if (lastVisitedDateAny) {
        const visitDate = new Date(lastVisitedDateAny);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisitAny = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const {
        id,
        created_at,
        updated_at,
        headOfficeId,
        areaId,
        head_office_id,
        area_id,
        HeadOffice,
        Area,
        ...cleanDoctorObj
      } = doctorObj;

      return {
        ...cleanDoctorObj,
        id: doctorObj.id,
        support_value_mtd: mtdMap[doctorObj.id] || 0.00,
        support_value_ytd: fyMap[doctorObj.id] || 0.00,
        headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
        area: doctorObj.Area || null,
        is_assigned_to_area: !!doctorObj.areaId,
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
        geo_image_status: !!doctorObj.geo_image_url,

        // Visited stats (by current requesting user)
        lastVisitedDate: lastVisitedDate,
        daysSinceLastVisit: daysSinceLastVisit,

        // Visited stats (by any user)
        lastVisitedDateAny: lastVisitedDateAny,
        daysSinceLastVisitAny: daysSinceLastVisitAny
      };
    });

    res.json({
      success: true,
      count: transformedDoctors.length,
      data: transformedDoctors
    });
  } catch (error) {
    console.error('Get my doctors error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// CREATE multiple doctors at once (Bulk Creation)
const createBulkDoctors = async (req, res) => {
  try {
    const models = req.app.get('models');
    if (!models || !models.Doctor || !models.HeadOffice) {
      throw new Error('Required models are not available');
    }
    const { Doctor, HeadOffice, Area } = models;

    // Validate request body
    if (!req.body.doctors || !Array.isArray(req.body.doctors)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must contain a "doctors" array'
      });
    }

    const doctorsData = req.body.doctors;

    if (doctorsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Doctors array cannot be empty'
      });
    }

    if (doctorsData.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create more than 100 doctors at once'
      });
    }

    console.log(`Creating ${doctorsData.length} doctors in bulk...`);

    // Process and validate each doctor data
    const processedDoctors = [];
    const errors = [];

    for (let i = 0; i < doctorsData.length; i++) {
      const sanitizedDoc = sanitizePayload(doctorsData[i]) || {};
      const doctorData = { ...sanitizedDoc };

      try {
        // Handle head office ID field conversion
        doctorData.headOfficeId = resolveHeadOfficeId(doctorData, req.user);
        delete doctorData.head_office_id;
        delete doctorData.headOffice;
        delete doctorData.head_office;

        doctorData.areaId = resolveAreaId(doctorData);
        delete doctorData.area_id;
        delete doctorData.area;

        if (doctorData.areaId) {
          if (!isUUID(doctorData.areaId)) {
            doctorData.areaId = null;
          } else if (Area) {
            const areaRecord = await Area.findByPk(doctorData.areaId);
            if (!areaRecord) {
              doctorData.areaId = null;
            }
          }
        } else {
          doctorData.areaId = null;
        }

        // Validate and set priority field
        if (doctorData.priority) {
          const priority = doctorData.priority.toUpperCase();
          if (!['A', 'B', 'C'].includes(priority)) {
            errors.push(`Doctor ${i + 1}: Priority must be A, B, or C`);
            continue;
          }
          doctorData.priority = priority;
        } else {
          // Default to 'C' if not provided
          doctorData.priority = 'C';
        }

        // Validate required fields
        if (!doctorData.name) {
          errors.push(`Doctor ${i + 1}: Name is required`);
          continue;
        }

        if (!doctorData.headOfficeId) {
          errors.push(`Doctor ${i + 1}: Head Office ID is required`);
          continue;
        }

        // Add index for tracking
        doctorData._index = i + 1;
        processedDoctors.push(doctorData);

      } catch (error) {
        errors.push(`Doctor ${i + 1}: ${error.message}`);
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found',
        errors: errors,
        validDoctors: processedDoctors.length,
        totalDoctors: doctorsData.length
      });
    }

    // Create doctors in bulk using transaction
    const sequelize = req.app.get('sequelize');
    const transaction = await sequelize.transaction();

    try {
      // Remove _index before creating
      const cleanDoctorsData = processedDoctors.map(doctor => {
        const { _index, ...cleanData } = doctor;
        return cleanData;
      });

      // Bulk create doctors
      const createdDoctors = await Doctor.bulkCreate(cleanDoctorsData, {
        transaction,
        returning: true, // Return created records
        validate: true   // Validate each record
      });

      // Track created doctors in DoctorChangeLog for delta sync
      const { DoctorChangeLog } = models;
      if (DoctorChangeLog && createdDoctors.length > 0) {
        try {
          const logs = createdDoctors.map(d => ({
            doctorId: d.id,
            operation: 'CREATE',
            headOfficeId: d.headOfficeId,
            areaId: d.areaId,
            snapshot: {
              name: d.name,
              priority: d.priority,
              clientGeneratedId: d.clientGeneratedId || d.client_generated_id || null
            }
          }));
          await DoctorChangeLog.bulkCreate(logs, { transaction });
        } catch (logErr) {
          console.warn('⚠️ Warning: Failed to create DoctorChangeLog in bulkCreate:', logErr.message);
        }
      }

      await transaction.commit();

      console.log(`Successfully created ${createdDoctors.length} doctors`);

      // Fetch created doctors with associations
      const doctorIds = createdDoctors.map(doctor => doctor.id);
      const doctorsWithAssociations = await Doctor.findAll({
        where: {
          id: { [require('sequelize').Op.in]: doctorIds }
        },
        include: [
          {
            model: HeadOffice,
            as: 'HeadOffice',
            attributes: ['id', 'name']
          },
          {
            model: Area,
            as: 'Area',
            attributes: ['id', 'name']
          }
        ]
      });

      // Transform the response to match the MongoDB format
      const transformedDoctors = doctorsWithAssociations.map(doctor => {
        const doctorObj = doctor.toJSON();
        return {
          ...doctorObj,
          headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
          area: doctorObj.Area || null,
          is_assigned_to_area: !!doctorObj.areaId,
          _id: doctorObj.id,
          createdAt: doctorObj.created_at,
          updatedAt: doctorObj.updated_at,
          // Remove the nested objects
          HeadOffice: undefined,
          Area: undefined
        };
      });

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdDoctors.length} doctors`,
        count: createdDoctors.length,
        data: transformedDoctors
      });

    } catch (createError) {
      await transaction.rollback();
      console.error('Bulk create error:', createError);

      res.status(400).json({
        success: false,
        message: 'Failed to create doctors',
        error: createError.message
      });
    }

  } catch (error) {
    console.error('Bulk create doctors error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getVisitedDoctorsInRange = async (req, res) => {
  try {
    const { Doctor, HeadOffice, User, Area, DoctorVisit } = req.app.get('models');
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Both "from" and "to" date parameters are required'
      });
    }

    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] }
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let headOfficeIds = [];
    if (user.headOffices && user.headOffices.length > 0) {
      headOfficeIds = user.headOffices.map(office => office.id);
    } else if (user.head_office_id) {
      headOfficeIds = [user.head_office_id];
    }

    if (headOfficeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No head office assigned to your account. Please contact an administrator.'
      });
    }

    // Find all unique doctor IDs visited in the given range
    const visits = await DoctorVisit.findAll({
      where: {
        date: {
          [require('sequelize').Op.between]: [from, to]
        }
      },
      attributes: ['doctor_id'],
      raw: true
    });

    const visitedIds = [...new Set(visits.map(v => v.doctor_id))];

    if (visitedIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const doctors = await Doctor.findAll({
      where: {
        headOfficeId: { [require('sequelize').Op.in]: headOfficeIds },
        id: { [require('sequelize').Op.in]: visitedIds }
      },
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'name']
        }
      ],
      distinct: true
    });

    const doctorIds = doctors.map(d => d.id);
    const mtdMap = await getSupportValueMtdMap(req.app.get('models'), doctorIds);
    const lastVisits = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        user_id: req.user.id,
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitMap = {};
    lastVisits.forEach(v => {
      lastVisitMap[v.doctor_id] = v.last_visit_date;
    });

    const lastVisitsAny = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitAnyMap = {};
    lastVisitsAny.forEach(v => {
      lastVisitAnyMap[v.doctor_id] = v.last_visit_date;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transformedDoctors = doctors.map(doctor => {
      const doctorObj = doctor.toJSON();
      const lastVisitedDate = lastVisitMap[doctorObj.id] || null;
      let daysSinceLastVisit = null;
      if (lastVisitedDate) {
        const visitDate = new Date(lastVisitedDate);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisit = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const lastVisitedDateAny = lastVisitAnyMap[doctorObj.id] || null;
      let daysSinceLastVisitAny = null;
      if (lastVisitedDateAny) {
        const visitDate = new Date(lastVisitedDateAny);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisitAny = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const {
        id,
        created_at,
        updated_at,
        headOfficeId,
        areaId,
        head_office_id,
        area_id,
        HeadOffice: hoDiscard,
        Area: areaDiscard,
        ...cleanDoctorObj
      } = doctorObj;

      return {
        ...cleanDoctorObj,
        support_value_mtd: mtdMap[doctorObj.id] || 0.00,
        headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
        area: doctorObj.Area || null,
        is_assigned_to_area: !!doctorObj.areaId,
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
        geo_image_status: !!doctorObj.geo_image_url,
        lastVisitedDate,
        daysSinceLastVisit,
        lastVisitedDateAny,
        daysSinceLastVisitAny
      };
    });

    res.json({
      success: true,
      count: transformedDoctors.length,
      data: transformedDoctors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getUnvisitedDoctorsInRange = async (req, res) => {
  try {
    const { Doctor, HeadOffice, User, Area, DoctorVisit } = req.app.get('models');
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Both "from" and "to" date parameters are required'
      });
    }

    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] }
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let headOfficeIds = [];
    if (user.headOffices && user.headOffices.length > 0) {
      headOfficeIds = user.headOffices.map(office => office.id);
    } else if (user.head_office_id) {
      headOfficeIds = [user.head_office_id];
    }

    if (headOfficeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No head office assigned to your account. Please contact an administrator.'
      });
    }

    // Find all unique doctor IDs visited in the given range
    const visits = await DoctorVisit.findAll({
      where: {
        date: {
          [require('sequelize').Op.between]: [from, to]
        }
      },
      attributes: ['doctor_id'],
      raw: true
    });

    const visitedIds = [...new Set(visits.map(v => v.doctor_id))];

    const whereClause = {
      headOfficeId: { [require('sequelize').Op.in]: headOfficeIds }
    };
    if (visitedIds.length > 0) {
      whereClause.id = { [require('sequelize').Op.notIn]: visitedIds };
    }

    const doctors = await Doctor.findAll({
      where: whereClause,
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Area,
          as: 'Area',
          attributes: ['id', 'name']
        }
      ],
      distinct: true
    });

    const doctorIds = doctors.map(d => d.id);
    const mtdMap = await getSupportValueMtdMap(req.app.get('models'), doctorIds);
    const lastVisits = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        user_id: req.user.id,
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitMap = {};
    lastVisits.forEach(v => {
      lastVisitMap[v.doctor_id] = v.last_visit_date;
    });

    const lastVisitsAny = doctorIds.length > 0 ? await DoctorVisit.findAll({
      where: {
        doctor_id: { [require('sequelize').Op.in]: doctorIds }
      },
      attributes: [
        'doctor_id',
        [require('sequelize').fn('max', require('sequelize').col('date')), 'last_visit_date']
      ],
      group: ['doctor_id'],
      raw: true
    }) : [];

    const lastVisitAnyMap = {};
    lastVisitsAny.forEach(v => {
      lastVisitAnyMap[v.doctor_id] = v.last_visit_date;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transformedDoctors = doctors.map(doctor => {
      const doctorObj = doctor.toJSON();
      const lastVisitedDate = lastVisitMap[doctorObj.id] || null;
      let daysSinceLastVisit = null;
      if (lastVisitedDate) {
        const visitDate = new Date(lastVisitedDate);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisit = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const lastVisitedDateAny = lastVisitAnyMap[doctorObj.id] || null;
      let daysSinceLastVisitAny = null;
      if (lastVisitedDateAny) {
        const visitDate = new Date(lastVisitedDateAny);
        visitDate.setHours(0, 0, 0, 0);
        const diffTime = today - visitDate;
        daysSinceLastVisitAny = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      const {
        id,
        created_at,
        updated_at,
        headOfficeId,
        areaId,
        head_office_id,
        area_id,
        HeadOffice: hoDiscard,
        Area: areaDiscard,
        ...cleanDoctorObj
      } = doctorObj;

      return {
        ...cleanDoctorObj,
        support_value_mtd: mtdMap[doctorObj.id] || 0.00,
        headOffice: doctorObj.HeadOffice || doctorObj.headOffice,
        area: doctorObj.Area || null,
        is_assigned_to_area: !!doctorObj.areaId,
        _id: doctorObj.id,
        createdAt: doctorObj.created_at,
        updatedAt: doctorObj.updated_at,
        geo_image_status: !!doctorObj.geo_image_url,
        lastVisitedDate,
        daysSinceLastVisit,
        lastVisitedDateAny,
        daysSinceLastVisitAny
      };
    });

    res.json({
      success: true,
      count: transformedDoctors.length,
      data: transformedDoctors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const setGlobalUcpmpCap = async (req, res) => {
  try {
    const { ucpmp_annual_cap } = req.body;
    if (ucpmp_annual_cap === undefined || isNaN(ucpmp_annual_cap) || Number(ucpmp_annual_cap) < 0) {
      return res.status(400).json({ success: false, message: 'Invalid or missing ucpmp_annual_cap' });
    }

    if (!['Super Admin', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Only Admins can set global caps' });
    }

    const { Doctor } = req.app.get('models');
    await Doctor.update(
      { ucpmp_annual_cap: Number(ucpmp_annual_cap) },
      { where: {} } // updates all records
    );

    res.json({
      success: true,
      message: `Global UCPMP annual cap updated to ₹${Number(ucpmp_annual_cap).toFixed(2)} for all doctors`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const setDoctorUcpmpCap = async (req, res) => {
  try {
    const { id } = req.params;
    const { ucpmp_annual_cap } = req.body;

    if (ucpmp_annual_cap === undefined || isNaN(ucpmp_annual_cap) || Number(ucpmp_annual_cap) < 0) {
      return res.status(400).json({ success: false, message: 'Invalid or missing ucpmp_annual_cap' });
    }

    if (!['Super Admin', 'Admin', 'State Head'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Only Admins or State Heads can modify caps' });
    }

    const { Doctor } = req.app.get('models');
    const doctor = await Doctor.findByPk(id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    await doctor.update({ ucpmp_annual_cap: Number(ucpmp_annual_cap) });

    res.json({
      success: true,
      message: `UCPMP annual cap updated to ₹${Number(ucpmp_annual_cap).toFixed(2)} for doctor ${doctor.name}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorsByHeadOffice,
  getMyDoctors,
  createBulkDoctors,
  assignAreaToDoctor,
  getVisitedDoctorsInRange,
  getUnvisitedDoctorsInRange,
  setGlobalUcpmpCap,
  setDoctorUcpmpCap,
  getDoctorEditRequests,
  approveDoctorEditRequest,
  rejectDoctorEditRequest,
  getSupportValueMtdMap,
  getSupportValueFyMap
};