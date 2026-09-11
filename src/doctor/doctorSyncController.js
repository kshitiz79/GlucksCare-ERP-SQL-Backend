const { Op } = require('sequelize');

// Helper to determine authorized headOfficeIds for the current user
const getAuthorizedHeadOfficeIds = async (user, models, requestedHeadOfficeId = null) => {
  const { User, HeadOffice } = models;

  // If Super Admin or Admin, they can access everything or filter if requested
  const isAdmin = ['Super Admin', 'Admin'].includes(user.role);
  if (isAdmin) {
    if (requestedHeadOfficeId) {
      return [requestedHeadOfficeId];
    }
    return null; // null means no head office restriction (all)
  }

  // Otherwise fetch user's assigned head offices
  const userWithOffices = await User.findByPk(user.id, {
    include: [
      {
        model: HeadOffice,
        as: 'headOffices',
        through: { attributes: [] }
      }
    ]
  });

  let headOfficeIds = [];
  if (userWithOffices?.headOffices && userWithOffices.headOffices.length > 0) {
    headOfficeIds = userWithOffices.headOffices.map(o => o.id);
  } else if (userWithOffices?.head_office_id) {
    headOfficeIds = [userWithOffices.head_office_id];
  }

  if (requestedHeadOfficeId) {
    // Ensure the user has permission for the requested head office
    if (headOfficeIds.includes(requestedHeadOfficeId)) {
      return [requestedHeadOfficeId];
    }
    return []; // No access
  }

  return headOfficeIds;
};

// Helper to format doctor payload for sync
const formatDoctorForSync = (doctor) => {
  const d = doctor.toJSON ? doctor.toJSON() : doctor;
  return {
    id: d.id,
    name: d.name,
    specialization: d.specialization || null,
    clinicName: d.clinic_name || d.clinicName || null,
    clinicAddress: d.clinic_address || d.clinicAddress || null,
    location: d.location || null,
    latitude: d.latitude ? Number(d.latitude) : null,
    longitude: d.longitude ? Number(d.longitude) : null,
    email: d.email || null,
    phone: d.phone || null,
    registrationNumber: d.registration_number || d.registrationNumber || null,
    yearsOfExperience: d.years_of_experience || d.yearsOfExperience || null,
    dateOfBirth: d.date_of_birth || d.dateOfBirth || null,
    qualification: d.qualification || null,
    consultationFee: d.consultation_fee ? Number(d.consultation_fee) : null,
    availableTimings: d.available_timings || d.availableTimings || null,
    geoImageUrl: d.geo_image_url || d.geoImageUrl || null,
    gender: d.gender || null,
    anniversary: d.anniversary || null,
    priority: d.priority || 'C',
    headOfficeId: d.headOfficeId || d.head_office_id || null,
    headOfficeName: d.HeadOffice?.name || null,
    areaId: d.areaId || d.area_id || null,
    areaName: d.Area?.name || null,
    ucpmpAnnualCap: d.ucpmp_annual_cap ? Number(d.ucpmp_annual_cap) : 10000.00,
    createdByName: d.createdByName || d.created_by_name || null,
    clientGeneratedId: d.clientGeneratedId || d.client_generated_id || null,
    client_generated_id: d.clientGeneratedId || d.client_generated_id || null,
    syncVersion: Number(d.syncVersion || d.sync_version || 1),
    createdAt: d.created_at || d.createdAt,
    updatedAt: d.updated_at || d.updatedAt
  };
};

/**
 * GET /api/doctors/sync/bootstrap
 * Cursor / Keyset-based and Page-based doctor bootstrap sync for fast and reliable master download
 *
 * Query params:
 * - limit: Number of records per batch (default 500, max 1000)
 * - cursor: Opaque base64 token representing the last record & snapshot version
 * - headOfficeId: Optional head office filter (if user is authorized)
 * - page: 1-based page number for offset pagination
 */
const getDoctorBootstrapSync = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Doctor, HeadOffice, Area, DoctorChangeLog } = models;

    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 500));

    // Decode cursor if provided
    let cursorData = null;
    if (req.query.cursor) {
      try {
        const raw = Buffer.from(req.query.cursor, 'base64').toString('utf-8');
        cursorData = JSON.parse(raw);
      } catch (e1) {
        try {
          const raw = Buffer.from(req.query.cursor, 'base64url').toString('utf-8');
          cursorData = JSON.parse(raw);
        } catch (e2) {
          if (typeof req.query.cursor === 'string' && req.query.cursor.trim().length > 0) {
            cursorData = { lastId: req.query.cursor.trim() };
          }
        }
      }
    }

    const authorizedHeadOfficeIds = await getAuthorizedHeadOfficeIds(
      req.user,
      models,
      req.query.headOfficeId
    );

    const whereClause = {};
    if (authorizedHeadOfficeIds !== null) {
      if (authorizedHeadOfficeIds.length === 0) {
        return res.json({
          success: true,
          snapshotVersion: 0,
          currentServerVersion: 0,
          nextCursor: null,
          hasMore: false,
          totalDoctors: 0,
          page: 1,
          limit,
          doctors: []
        });
      }
      whereClause.headOfficeId = { [Op.in]: authorizedHeadOfficeIds };
    }

    // Determine snapshot version
    let snapshotVersion = 0;
    if (cursorData && cursorData.snapshotVersion) {
      snapshotVersion = Number(cursorData.snapshotVersion);
    } else {
      const [maxChangeLog, maxDocVersion] = await Promise.all([
        DoctorChangeLog ? DoctorChangeLog.max('changeVersion').catch(() => 0) : 0,
        Doctor.max('syncVersion').catch(() => 1)
      ]);
      snapshotVersion = Math.max(
        Number(maxChangeLog || 0),
        Number(maxDocVersion || 1),
        1
      );
    }

    // Page-based offset pagination (when page parameter is provided and no cursor)
    const pageParam = req.query.page ? parseInt(req.query.page, 10) : null;
    if (pageParam && pageParam >= 1 && !req.query.cursor) {
      const page = pageParam;
      const offset = (page - 1) * limit;
      const [totalDoctors, doctors] = await Promise.all([
        Doctor.count({ where: whereClause }),
        Doctor.findAll({
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
          order: [['created_at', 'DESC'], ['id', 'DESC']],
          limit: limit,
          offset,
          distinct: true
        })
      ]);

      const hasMore = (offset + doctors.length) < totalDoctors;
      const lastDoc = doctors.length > 0 ? doctors[doctors.length - 1] : null;
      const nextCursor = hasMore && lastDoc
        ? Buffer.from(JSON.stringify({ lastId: lastDoc.id, snapshotVersion })).toString('base64')
        : null;

      return res.json({
        success: true,
        snapshotVersion,
        currentServerVersion: snapshotVersion,
        nextCursor,
        hasMore,
        totalDoctors,
        totalPages: Math.ceil(totalDoctors / limit),
        page,
        limit,
        doctors: doctors.map(formatDoctorForSync)
      });
    }

    // Keyset / Cursor Pagination
    const lastId = cursorData?.lastId || cursorData?.id;
    if (lastId) {
      whereClause.id = { [Op.gt]: lastId };
    }

    const [totalDoctors, doctors] = await Promise.all([
      Doctor.count({ where: whereClause }),
      Doctor.findAll({
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
        order: [['id', 'ASC']],
        limit: limit + 1,
        distinct: true
      })
    ]);

    const hasMore = doctors.length > limit;
    const results = hasMore ? doctors.slice(0, limit) : doctors;

    let nextCursor = null;
    if (hasMore && results.length > 0) {
      const lastDoc = results[results.length - 1];
      const cursorPayload = {
        lastId: lastDoc.id,
        snapshotVersion
      };
      nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString('base64');
    }

    const formattedDoctors = results.map(formatDoctorForSync);

    return res.json({
      success: true,
      snapshotVersion,
      currentServerVersion: snapshotVersion,
      nextCursor,
      hasMore,
      totalDoctors,
      page: 1,
      limit,
      doctors: formattedDoctors
    });
  } catch (error) {
    console.error('Error in getDoctorBootstrapSync:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /api/doctors/sync
 * Delta sync: Returns records created/updated/deleted after `afterVersion`
 * Query params: afterVersion (BIGINT, default 0), limit (default 500), headOfficeId
 */
const getDoctorDeltaSync = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Doctor, HeadOffice, Area, DoctorChangeLog } = models;

    const afterVersion = parseInt(req.query.afterVersion || req.query.sinceVersion, 10) || 0;
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 500));

    const authorizedHeadOfficeIds = await getAuthorizedHeadOfficeIds(
      req.user,
      models,
      req.query.headOfficeId
    );

    // Get current global server version
    const [maxChangeLog, maxDocVersion] = await Promise.all([
      DoctorChangeLog ? DoctorChangeLog.max('changeVersion').catch(() => 0) : 0,
      Doctor.max('syncVersion').catch(() => 1)
    ]);

    const currentServerVersion = Math.max(
      Number(maxChangeLog || 0),
      Number(maxDocVersion || 1),
      1
    );

    // 1. Check DoctorChangeLog for changes after afterVersion
    let logWhere = {
      changeVersion: { [Op.gt]: afterVersion }
    };
    if (authorizedHeadOfficeIds !== null) {
      if (authorizedHeadOfficeIds.length === 0) {
        return res.json({
          success: true,
          currentServerVersion,
          afterVersion,
          hasMore: false,
          upserts: [],
          deletes: []
        });
      }
      logWhere[Op.or] = [
        { headOfficeId: { [Op.in]: authorizedHeadOfficeIds } },
        { headOfficeId: null }
      ];
    }

    const changeLogs = DoctorChangeLog ? await DoctorChangeLog.findAll({
      where: logWhere,
      order: [['changeVersion', 'ASC']],
      limit: limit * 2,
      raw: true
    }).catch(() => []) : [];

    // Group logs by doctorId
    const latestDoctorOps = new Map();
    const deletedDoctorIds = new Set();
    const activeDoctorIds = new Set();

    for (const log of changeLogs) {
      const docId = log.doctor_id || log.doctorId;
      const ver = Number(log.change_version || log.changeVersion || 0);
      const createdAt = log.created_at || log.createdAt || new Date();

      if (log.operation === 'DELETE') {
        latestDoctorOps.set(docId, {
          operation: 'DELETE',
          doctorId: docId,
          changeVersion: ver,
          deletedAt: createdAt
        });
        deletedDoctorIds.add(docId);
        activeDoctorIds.delete(docId);
      } else {
        latestDoctorOps.set(docId, {
          operation: log.operation,
          doctorId: docId,
          changeVersion: ver
        });
        activeDoctorIds.add(docId);
        deletedDoctorIds.delete(docId);
      }
    }

    // 2. Fetch live doctors from active change logs OR doctors whose syncVersion > afterVersion
    let liveDoctorWhere = {};
    if (activeDoctorIds.size > 0) {
      liveDoctorWhere[Op.or] = [
        { id: { [Op.in]: Array.from(activeDoctorIds) } },
        { syncVersion: { [Op.gt]: afterVersion } }
      ];
    } else {
      liveDoctorWhere.syncVersion = { [Op.gt]: afterVersion };
    }

    if (authorizedHeadOfficeIds !== null) {
      liveDoctorWhere.headOfficeId = { [Op.in]: authorizedHeadOfficeIds };
    }

    const liveDoctors = await Doctor.findAll({
      where: liveDoctorWhere,
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
      order: [['sync_version', 'ASC'], ['updated_at', 'ASC']],
      limit
    });

    const formattedUpserts = liveDoctors.map(formatDoctorForSync);

    const formattedDeletes = Array.from(deletedDoctorIds).map(id => {
      const op = latestDoctorOps.get(id);
      return {
        id,
        changeVersion: op?.changeVersion || afterVersion,
        deletedAt: op?.deletedAt || new Date()
      };
    });

    const hasMore = changeLogs.length >= limit * 2 || liveDoctors.length >= limit;

    return res.json({
      success: true,
      snapshotVersion: currentServerVersion,
      currentServerVersion,
      afterVersion,
      hasMore,
      upserts: formattedUpserts,
      deletes: formattedDeletes
    });
  } catch (error) {
    console.error('Error in getDoctorDeltaSync:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getDoctorBootstrapSync,
  getDoctorDeltaSync,
  formatDoctorForSync
};
