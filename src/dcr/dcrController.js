const { Op } = require('sequelize');

/**
 * Helper to get date string formatted in Indian Standard Time (Asia/Kolkata) as YYYY-MM-DD
 */
const getISTDateString = (d = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

/**
 * Helper to compute date range based on filter string ('today', 'weekly', 'monthly', 'custom') in IST
 */
const getDateRange = (filter, startDate, endDate) => {
  const todayISTStr = getISTDateString();

  if (startDate) {
    return {
      start: startDate,
      end: endDate || startDate
    };
  }

  if (filter && /^\d{4}-\d{2}-\d{2}$/.test(filter)) {
    return {
      start: filter,
      end: filter
    };
  }

  const [yearStr, monthStr, dayStr] = todayISTStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  if (filter === 'weekly') {
    const nowIST = new Date(year, month, day);
    const currentDay = nowIST.getDay();
    const distanceToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    const monday = new Date(nowIST);
    monday.setDate(nowIST.getDate() + distanceToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    return {
      start: formatDate(monday),
      end: formatDate(sunday)
    };
  }

  if (filter === 'monthly') {
    const firstDayStr = `${yearStr}-${monthStr}-01`;
    const lastDayNum = new Date(year, month + 1, 0).getDate();
    const lastDayStr = `${yearStr}-${monthStr}-${String(lastDayNum).padStart(2, '0')}`;

    return {
      start: firstDayStr,
      end: lastDayStr
    };
  }

  // Default: 'today' in IST
  return {
    start: todayISTStr,
    end: todayISTStr
  };
};

/**
 * GET DCR Mobile API for State Head & Managers
 * Combines DoctorVisits, ChemistVisits, and StockistVisits for users in the State Head's jurisdiction.
 */
const getStateHeadMobileDcr = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');

    if (!models) {
      return res.status(500).json({
        success: false,
        message: 'Database models not initialized'
      });
    }

    const {
      DoctorVisit,
      ChemistVisit,
      StockistVisit,
      Doctor,
      Chemist,
      Stockist,
      User,
      State
    } = models;

    const loggedInUser = req.user;
    const { filter = 'today', startDate, endDate, visit_type = 'all', user_id, page = 1, limit = 100 } = req.query;

    // 1. Calculate Date Range
    const { start: dateStart, end: dateEnd } = getDateRange(filter, startDate, endDate);

    // 2. Determine target user IDs under State Head jurisdiction
    let targetUserIds = [];

    if (user_id) {
      targetUserIds = [user_id];
    } else {
      // Always include logged in user
      targetUserIds.push(loggedInUser.id);

      if (['State Head', 'National Head', 'Admin', 'Super Admin'].includes(loggedInUser.role)) {
        if (loggedInUser.role === 'State Head' && loggedInUser.state_id) {
          // Fetch users belonging to head offices in State Head's state
          const stateUsers = await sequelize.query(`
            SELECT DISTINCT u.id
            FROM users u
            LEFT JOIN user_head_offices uho ON u.id = uho.user_id
            LEFT JOIN head_offices ho ON uho.head_office_id = ho.id
            WHERE (ho.state_id = :stateId OR u.state_id = :stateId)
            AND u.is_active = true
          `, {
            replacements: { stateId: loggedInUser.state_id },
            type: sequelize.QueryTypes.SELECT
          });

          const foundIds = (stateUsers || []).map(u => u.id);
          targetUserIds = Array.from(new Set([...targetUserIds, ...foundIds]));
        } else {
          // If no state assigned or Super Admin/Admin/National Head, fetch all active users or subordinates
          const allUsers = await User.findAll({
            where: { is_active: true },
            attributes: ['id']
          });
          const foundIds = (allUsers || []).map(u => u.id);
          targetUserIds = Array.from(new Set([...targetUserIds, ...foundIds]));
        }
      }
    }

    // Common date filter condition
    const dateWhere = {
      date: {
        [Op.between]: [dateStart, dateEnd]
      },
      user_id: {
        [Op.in]: targetUserIds
      }
    };

    // User attributes for includes
    const userAttributes = ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'head_office_id', 'state_id'];

    // 3. Fetch Visits in Parallel
    const fetchPromises = [];

    // Doctor Visits
    if (visit_type === 'all' || visit_type === 'doctor') {
      fetchPromises.push(
        DoctorVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Doctor,
              as: 'DoctorInfo',
              attributes: ['id', 'name', 'email', 'phone', 'clinic_name', 'clinic_address', 'location', 'qualification', 'specialization']
            },
            {
              model: User,
              as: 'UserInfo',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => {
          const obj = v.toJSON();
          obj.User = obj.UserInfo || null;
          delete obj.UserInfo;
          return { visit_type: 'doctor', ...obj };
        }))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    // Chemist Visits
    if (visit_type === 'all' || visit_type === 'chemist') {
      fetchPromises.push(
        ChemistVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Chemist,
              as: 'Chemist',
              attributes: ['id', 'firm_name', 'contact_person_name', 'mobile_no', 'email_id', 'address', 'designation']
            },
            {
              model: User,
              as: 'User',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => ({
          visit_type: 'chemist',
          ...v.toJSON()
        })))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    // Stockist Visits
    if (visit_type === 'all' || visit_type === 'stockist') {
      fetchPromises.push(
        StockistVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Stockist,
              as: 'Stockist',
              attributes: ['id', 'firm_name', 'registered_business_name', 'contact_person', 'mobile_number', 'email_address', 'registered_office_address', 'designation']
            },
            {
              model: User,
              as: 'User',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => ({
          visit_type: 'stockist',
          ...v.toJSON()
        })))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    const [doctorVisits, chemistVisits, stockistVisits] = await Promise.all(fetchPromises);

    // 4. Combine & Sort All Visits
    const combinedVisits = [...doctorVisits, ...chemistVisits, ...stockistVisits];
    combinedVisits.sort((a, b) => {
      const timeA = a.created_at || a.createdAt || a.date;
      const timeB = b.created_at || b.createdAt || b.date;
      return new Date(timeB) - new Date(timeA);
    });

    // 5. Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedVisits = combinedVisits.slice(startIndex, startIndex + limitNum);

    // 6. Summary Statistics
    const uniqueUserIds = new Set(combinedVisits.map(v => v.user_id));

    // Optional State Info if available
    let stateInfo = null;
    if (loggedInUser.state_id && State) {
      stateInfo = await State.findByPk(loggedInUser.state_id, {
        attributes: ['id', 'name', 'code']
      });
    }

    res.json({
      success: true,
      message: 'State Head Mobile DCR data retrieved successfully',
      filter: {
        applied: filter,
        startDate: dateStart,
        endDate: dateEnd,
        visit_type: visit_type,
        state: stateInfo
      },
      summary: {
        total_visits: combinedVisits.length,
        doctor_visits_count: doctorVisits.length,
        chemist_visits_count: chemistVisits.length,
        stockist_visits_count: stockistVisits.length,
        total_active_users: uniqueUserIds.size,
        total_jurisdiction_users: targetUserIds.length
      },
      pagination: {
        total: combinedVisits.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(combinedVisits.length / limitNum)
      },
      data: paginatedVisits
    });

  } catch (error) {
    console.error('Get State Head Mobile DCR error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch DCR data'
    });
  }
};

/**
 * GET User-Wise Visit List API
 * Groups all 3 visit types (Doctor, Chemist, Stockist) by User / Field Force Executive
 */
const getUserWiseVisits = async (req, res) => {
  try {
    const models = req.app.get('models');
    const sequelize = req.app.get('sequelize');

    if (!models) {
      return res.status(500).json({
        success: false,
        message: 'Database models not initialized'
      });
    }

    const {
      DoctorVisit,
      ChemistVisit,
      StockistVisit,
      Doctor,
      Chemist,
      Stockist,
      User
    } = models;

    const loggedInUser = req.user;
    const { filter = 'today', startDate, endDate, visit_type = 'all', user_id, role, state_id, head_office_id, page = 1, limit = 50 } = req.query;

    // 1. Calculate Date Range
    const { start: dateStart, end: dateEnd } = getDateRange(filter, startDate, endDate);

    // 2. Determine target user IDs
    let targetUserIds = [];

    if (user_id) {
      targetUserIds = [user_id];
    } else {
      const userWhere = { is_active: true };
      if (state_id || (loggedInUser.role === 'State Head' && loggedInUser.state_id)) {
        userWhere.state_id = state_id || loggedInUser.state_id;
      }
      if (role) {
        userWhere.role = role;
      }

      let usersQuery;
      if (head_office_id) {
        // Filter by head office via both users.head_office_id and user_head_offices join table
        const hoUsers = await sequelize.query(
          `SELECT DISTINCT u.id FROM users u
           LEFT JOIN user_head_offices uho ON u.id = uho.user_id
           WHERE u.is_active = true
             AND (u.head_office_id = :hoId OR uho.head_office_id = :hoId)
             ${state_id ? 'AND u.state_id = :stateId' : ''}
             ${role ? "AND u.role = :roleVal" : ''}`,
          {
            replacements: {
              hoId: head_office_id,
              ...(state_id ? { stateId: state_id } : {}),
              ...(role ? { roleVal: role } : {})
            },
            type: sequelize.QueryTypes.SELECT
          }
        );
        const foundIds = (hoUsers || []).map(u => u.id);
        targetUserIds = Array.from(new Set([loggedInUser.id, ...foundIds]));
      } else {
        const usersList = await User.findAll({
          where: userWhere,
          attributes: ['id']
        });
        const foundIds = usersList.map(u => u.id);
        targetUserIds = Array.from(new Set([loggedInUser.id, ...foundIds]));
      }
    }

    // Date filter condition
    const dateWhere = {
      date: {
        [Op.between]: [dateStart, dateEnd]
      },
      user_id: {
        [Op.in]: targetUserIds
      }
    };

    const userAttributes = ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'head_office_id', 'state_id'];

    // 3. Fetch Visits in Parallel
    const fetchPromises = [];

    // Doctor Visits
    // DoctorVisit.js defines the User association as alias 'UserInfo' — must use that here
    if (visit_type === 'all' || visit_type === 'doctor') {
      fetchPromises.push(
        DoctorVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Doctor,
              as: 'DoctorInfo',
              attributes: ['id', 'name', 'email', 'phone', 'clinic_name', 'clinic_address', 'location', 'qualification', 'specialization']
            },
            {
              model: User,
              as: 'UserInfo',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => {
          const obj = v.toJSON();
          // Normalise to 'User' key so grouping logic below works uniformly
          obj.User = obj.UserInfo || null;
          delete obj.UserInfo;
          return { visit_type: 'doctor', ...obj };
        }))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    // Chemist Visits — ChemistVisit.js defines alias 'User' ✓
    if (visit_type === 'all' || visit_type === 'chemist') {
      fetchPromises.push(
        ChemistVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Chemist,
              as: 'Chemist',
              attributes: ['id', 'firm_name', 'contact_person_name', 'mobile_no', 'email_id', 'address', 'designation']
            },
            {
              model: User,
              as: 'User',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => ({ visit_type: 'chemist', ...v.toJSON() })))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    // Stockist Visits — StockistVisit.js defines alias 'User' ✓
    if (visit_type === 'all' || visit_type === 'stockist') {
      fetchPromises.push(
        StockistVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Stockist,
              as: 'Stockist',
              attributes: ['id', 'firm_name', 'registered_business_name', 'contact_person', 'mobile_number', 'email_address', 'registered_office_address', 'designation']
            },
            {
              model: User,
              as: 'User',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => ({ visit_type: 'stockist', ...v.toJSON() })))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    const [doctorVisits, chemistVisits, stockistVisits] = await Promise.all(fetchPromises);
    const combinedVisits = [...doctorVisits, ...chemistVisits, ...stockistVisits];

    // 4. Group Visits by User
    const userVisitMap = new Map();

    const { State, HeadOffice } = models;

    const allUsersData = await User.findAll({
      where: { id: targetUserIds },
      attributes: userAttributes,
      include: [
        ...(State ? [{ model: State, as: 'State', attributes: ['id', 'name', 'code'], required: false }] : []),
        ...(HeadOffice ? [{ model: HeadOffice, as: 'headOffices', attributes: ['id', 'name'], through: { attributes: [] }, required: false }] : [])
      ]
    });

    allUsersData.forEach(u => {
      const uJson = u.toJSON();
      if (uJson.State) {
        uJson.state_name = uJson.State.name;
      }
      if (uJson.headOffices && uJson.headOffices.length > 0) {
        uJson.head_office_name = uJson.headOffices[0].name;
      }

      userVisitMap.set(u.id, {
        user: uJson,
        stats: {
          total_visits: 0,
          doctor_visits_count: 0,
          chemist_visits_count: 0,
          stockist_visits_count: 0
        },
        visits: []
      });
    });

    combinedVisits.forEach(v => {
      let userEntry = userVisitMap.get(v.user_id);
      if (!userEntry) {
        userEntry = {
          user: v.User || { id: v.user_id },
          stats: {
            total_visits: 0,
            doctor_visits_count: 0,
            chemist_visits_count: 0,
            stockist_visits_count: 0
          },
          visits: []
        };
        userVisitMap.set(v.user_id, userEntry);
      }

      userEntry.visits.push(v);
      userEntry.stats.total_visits += 1;
      if (v.visit_type === 'doctor') userEntry.stats.doctor_visits_count += 1;
      if (v.visit_type === 'chemist') userEntry.stats.chemist_visits_count += 1;
      if (v.visit_type === 'stockist') userEntry.stats.stockist_visits_count += 1;
    });

    const userWiseList = Array.from(userVisitMap.values());
    userWiseList.sort((a, b) => b.stats.total_visits - a.stats.total_visits);

    userWiseList.forEach(item => {
      item.visits.sort((a, b) => {
        const timeA = a.created_at || a.createdAt || a.date;
        const timeB = b.created_at || b.createdAt || b.date;
        return new Date(timeB) - new Date(timeA);
      });
    });

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUserList = userWiseList.slice(startIndex, startIndex + limitNum);

    const activeUsersCount = userWiseList.filter(u => u.stats.total_visits > 0).length;

    res.json({
      success: true,
      message: 'User-wise visit list retrieved successfully',
      filter: {
        applied: filter,
        startDate: dateStart,
        endDate: dateEnd,
        visit_type: visit_type
      },
      summary: {
        total_users: userWiseList.length,
        active_users_with_visits: activeUsersCount,
        total_visits: combinedVisits.length,
        total_doctor_visits: doctorVisits.length,
        total_chemist_visits: chemistVisits.length,
        total_stockist_visits: stockistVisits.length
      },
      pagination: {
        total_users: userWiseList.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(userWiseList.length / limitNum)
      },
      data: paginatedUserList
    });

  } catch (error) {
    console.error('Get user-wise visits error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user-wise visit list'
    });
  }
};

/**
 * GET DCR Visits for a Specific User ID
 * Endpoint: GET /api/dcr/user/:userId
 */
const getUserDcrById = async (req, res) => {
  try {
    const models = req.app.get('models');

    if (!models) {
      return res.status(500).json({
        success: false,
        message: 'Database models not initialized'
      });
    }

    const {
      DoctorVisit,
      ChemistVisit,
      StockistVisit,
      Doctor,
      Chemist,
      Stockist,
      User
    } = models;

    const { userId } = req.params;
    const { filter = 'today', startDate, endDate, visit_type = 'all', page = 1, limit = 100 } = req.query;

    // 1. Verify target user exists
    const targetUser = await User.findByPk(userId, {
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'head_office_id', 'state_id']
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${userId} not found`
      });
    }

    // 2. Calculate Date Range
    const { start: dateStart, end: dateEnd } = getDateRange(filter, startDate, endDate);

    const dateWhere = {
      user_id: userId,
      date: {
        [Op.between]: [dateStart, dateEnd]
      }
    };

    const userAttributes = ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'head_office_id', 'state_id'];

    // 3. Fetch Visits in Parallel
    const fetchPromises = [];

    // Doctor Visits
    if (visit_type === 'all' || visit_type === 'doctor') {
      fetchPromises.push(
        DoctorVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Doctor,
              as: 'DoctorInfo',
              attributes: ['id', 'name', 'email', 'phone', 'clinic_name', 'clinic_address', 'location', 'qualification', 'specialization']
            },
            {
              model: User,
              as: 'UserInfo',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => {
          const obj = v.toJSON();
          obj.User = obj.UserInfo || null;
          delete obj.UserInfo;
          return { visit_type: 'doctor', ...obj };
        }))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    // Chemist Visits
    if (visit_type === 'all' || visit_type === 'chemist') {
      fetchPromises.push(
        ChemistVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Chemist,
              as: 'Chemist',
              attributes: ['id', 'firm_name', 'contact_person_name', 'mobile_no', 'email_id', 'address', 'designation']
            },
            {
              model: User,
              as: 'User',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => ({ visit_type: 'chemist', ...v.toJSON() })))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    // Stockist Visits
    if (visit_type === 'all' || visit_type === 'stockist') {
      fetchPromises.push(
        StockistVisit.findAll({
          where: dateWhere,
          include: [
            {
              model: Stockist,
              as: 'Stockist',
              attributes: ['id', 'firm_name', 'registered_business_name', 'contact_person', 'mobile_number', 'email_address', 'registered_office_address', 'designation']
            },
            {
              model: User,
              as: 'User',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => ({ visit_type: 'stockist', ...v.toJSON() })))
      );
    } else {
      fetchPromises.push(Promise.resolve([]));
    }

    const [doctorVisits, chemistVisits, stockistVisits] = await Promise.all(fetchPromises);

    // 4. Combine & Sort All Visits for this user
    const combinedVisits = [...doctorVisits, ...chemistVisits, ...stockistVisits];
    combinedVisits.sort((a, b) => {
      const timeA = a.created_at || a.createdAt || a.date;
      const timeB = b.created_at || b.createdAt || b.date;
      return new Date(timeB) - new Date(timeA);
    });

    // 5. Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedVisits = combinedVisits.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      message: `DCR visits for user ${targetUser.name} retrieved successfully`,
      user: targetUser,
      filter: {
        applied: filter,
        startDate: dateStart,
        endDate: dateEnd,
        visit_type: visit_type
      },
      stats: {
        total_visits: combinedVisits.length,
        doctor_visits_count: doctorVisits.length,
        chemist_visits_count: chemistVisits.length,
        stockist_visits_count: stockistVisits.length
      },
      pagination: {
        total: combinedVisits.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(combinedVisits.length / limitNum)
      },
      data: paginatedVisits
    });

  } catch (error) {
    console.error('Get user DCR by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user DCR visits'
    });
  }
};

module.exports = {
  getStateHeadMobileDcr,
  getUserWiseVisits,
  getUserDcrById
};
