const { Op } = require('sequelize');

/**
 * Helper to compute date range based on filter string ('today', 'weekly', 'monthly', 'custom')
 */
const getDateRange = (filter, startDate, endDate) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Format date to YYYY-MM-DD
  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (filter === 'weekly') {
    // Current week: Monday to Sunday
    const currentDay = now.getDay();
    const distanceToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: formatDate(monday),
      end: formatDate(sunday)
    };
  }

  if (filter === 'monthly') {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return {
      start: formatDate(firstDay),
      end: formatDate(lastDay)
    };
  }

  if (filter === 'custom' && startDate && endDate) {
    return {
      start: startDate,
      end: endDate
    };
  }

  // Default: 'today'
  const todayStr = formatDate(now);
  return {
    start: todayStr,
    end: todayStr
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
              as: 'User',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => ({
          visit_type: 'doctor',
          ...v.toJSON()
        })))
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
    const { filter = 'today', startDate, endDate, visit_type = 'all', user_id, role, state_id, page = 1, limit = 50 } = req.query;

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

      const usersList = await User.findAll({
        where: userWhere,
        attributes: ['id']
      });
      const foundIds = usersList.map(u => u.id);
      targetUserIds = Array.from(new Set([loggedInUser.id, ...foundIds]));
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
              as: 'User',
              attributes: userAttributes
            }
          ],
          order: [['date', 'DESC']]
        }).then(visits => visits.map(v => ({ visit_type: 'doctor', ...v.toJSON() })))
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
    const combinedVisits = [...doctorVisits, ...chemistVisits, ...stockistVisits];

    // 4. Group Visits by User
    const userVisitMap = new Map();

    const allUsersData = await User.findAll({
      where: { id: targetUserIds },
      attributes: userAttributes
    });

    allUsersData.forEach(u => {
      userVisitMap.set(u.id, {
        user: u.toJSON(),
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

module.exports = {
  getStateHeadMobileDcr,
  getUserWiseVisits
};
