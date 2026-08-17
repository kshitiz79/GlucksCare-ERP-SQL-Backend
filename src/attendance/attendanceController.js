const { Op } = require('sequelize');

// Utility function to get current date in IST (India Standard Time)
const getISTDate = () => {
  const now = new Date();
  // Convert to IST (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().split('T')[0]; // Return YYYY-MM-DD format
};

// Utility function to get current IST datetime
const getISTDateTime = () => {
  return new Date();
};

// Helper to convert Date String (YYYY-MM-DD) and Time String (HH:MM:SS) to IST Date object
const getShiftDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const isoStr = `${dateStr}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`;
  return new Date(isoStr);
};

// Helper to resolve an employee's effective assigned shift
const getEffectiveUserShift = async (userId, dateStr, models) => {
  try {
    const { UserShift, Shift } = models;
    if (!UserShift || !Shift) {
      return {
        id: null,
        name: 'General Shift',
        start_time: '10:00:00',
        end_time: '18:00:00',
        minimum_hours: 8,
        half_day_threshold: 4,
        grace_period: 15,
        break_duration: 60
      };
    }

    // 1. Try finding individual assigned shift (ordered by assigned_at DESC)
    const userShift = await UserShift.findOne({
      where: { user_id: userId },
      include: [{ model: Shift, as: 'shift' }],
      order: [['assigned_at', 'DESC NULLS LAST']]
    });

    if (userShift && userShift.shift && userShift.shift.is_active !== false) {
      return userShift.shift;
    }

    // 2. Direct database query fallback to ensure exact assigned shift lookup
    const sequelize = models.sequelize || UserShift.sequelize;
    if (sequelize) {
      const rows = await sequelize.query(
        `
        SELECT s.* 
        FROM user_shifts us
        JOIN shifts s ON s.id = us.shift_id
        WHERE us.user_id = :userId AND (s.is_active = true OR s.is_active IS NULL)
        ORDER BY us.assigned_at DESC NULLS LAST
        LIMIT 1
        `,
        {
          replacements: { userId },
          type: sequelize.QueryTypes.SELECT
        }
      );
      if (rows && rows.length > 0) {
        return rows[0];
      }
    }

    // 3. Fallback to active default general shift in database
    const defaultShift = await Shift.findOne({
      where: { is_active: true },
      order: [['created_at', 'ASC']]
    });

    if (defaultShift) {
      return defaultShift;
    }

    // 4. Default fallback
    return {
      id: null,
      name: 'General Shift',
      start_time: '10:00:00',
      end_time: '18:00:00',
      minimum_hours: 8,
      half_day_threshold: 4,
      grace_period: 15,
      break_duration: 60
    };
  } catch (err) {
    console.warn('getEffectiveUserShift error:', err.message);
    return {
      id: null,
      name: 'General Shift',
      start_time: '10:00:00',
      end_time: '18:00:00',
      minimum_hours: 8,
      half_day_threshold: 4,
      grace_period: 15,
      break_duration: 60
    };
  }
};

// Util to calculate break times
const calculateBreaks = (punchSessions) => {
  const autoBreaks = [];
  let totalBreakMinutes = 0;

  if (punchSessions.length > 1) {
    for (let i = 1; i < punchSessions.length; i++) {
      const previousSession = punchSessions[i - 1];
      const currentSession = punchSessions[i];

      if (previousSession.punchOut && currentSession.punchIn) {
        const breakStart = new Date(previousSession.punchOut);
        const breakEnd = new Date(currentSession.punchIn);
        const breakMinutes = (breakEnd - breakStart) / (1000 * 60);

        if (breakMinutes > 0) {
          autoBreaks.push({
            start: breakStart,
            end: breakEnd,
            duration: Math.floor(breakMinutes)
          });

          totalBreakMinutes += Math.floor(breakMinutes);
        }
      }
    }
  }

  return {
    autoBreaks,
    totalBreakMinutes: Math.floor(totalBreakMinutes)
  };
};

// Auto Punch-Out & Working Hours settlement engine
const processAutoPunchOut = async (attendance, models, now = new Date()) => {
  try {
    if (!attendance) return null;

    const punchSessions = Array.isArray(attendance.punch_sessions)
      ? JSON.parse(JSON.stringify(attendance.punch_sessions))
      : [];
    const currentSessionIdx = attendance.current_session;

    const isOpen = (currentSessionIdx >= 0 && punchSessions[currentSessionIdx] && !punchSessions[currentSessionIdx].punchOut)
      || attendance.status === 'punched_in';

    const isSunday = new Date(attendance.date).getDay() === 0;
    const isMisclassifiedHalfDay = (attendance.total_working_minutes || 0) >= 300 && attendance.status === 'half_day';

    if (!isOpen && !isExcessiveDuration && !isSunday && !isMisclassifiedHalfDay) return attendance;

    // Get effective shift for this attendance
    const shift = await getEffectiveUserShift(attendance.user_id, attendance.date, models);
    const shiftEndTime = shift?.end_time || '18:00:00';
    const shiftStartTime = shift?.start_time || '10:00:00';
    const expectedPunchOut = getShiftDateTime(attendance.date, shiftEndTime);
    const expectedPunchIn = getShiftDateTime(attendance.date, shiftStartTime);

    const todayIST = getISTDate();
    const isPastDate = attendance.date < todayIST;
    const isPastShiftEnd = expectedPunchOut && now >= expectedPunchOut;

    // Settle open session if shift end has passed or date is in the past, or repair excessive minutes / misclassifications
    if (isPastDate || isPastShiftEnd || isExcessiveDuration || isSunday || isMisclassifiedHalfDay) {
      if (isOpen) {
        const activeSession = (currentSessionIdx >= 0 && punchSessions[currentSessionIdx])
          ? punchSessions[currentSessionIdx]
          : punchSessions[punchSessions.length - 1];

        if (activeSession && !activeSession.punchOut) {
          const punchInTime = new Date(activeSession.punchIn);
          let autoPunchOutTime = expectedPunchOut;

          // If punched in after shift end on that day, cap at punchInTime (0 min duration)
          if (punchInTime > autoPunchOutTime) {
            autoPunchOutTime = punchInTime;
          }

          activeSession.punchOut = autoPunchOutTime;
          activeSession.durationMinutes = Math.max(0, Math.min(1440, Math.floor((autoPunchOutTime - punchInTime) / (1000 * 60))));
          activeSession.isAutoPunchOut = true;
        }
      }

      // Sanitize all sessions to ensure no session crosses day boundaries or has excessive duration
      let totalWorkingMinutes = 0;
      for (let i = 0; i < punchSessions.length; i++) {
        const s = punchSessions[i];
        if (s.punchIn && s.punchOut) {
          const pIn = new Date(s.punchIn);
          let pOut = new Date(s.punchOut);

          // If punchOut is on a future date beyond attendance.date, cap to expectedPunchOut on attendance.date
          const pOutDateStr = pOut.toISOString().split('T')[0];
          if (pOutDateStr > attendance.date || pOut < pIn) {
            pOut = (expectedPunchOut && expectedPunchOut > pIn) ? expectedPunchOut : pIn;
            s.punchOut = pOut;
          }

          let dur = Math.max(0, Math.floor((pOut - pIn) / (1000 * 60)));
          if (dur > 1440) {
            dur = Math.max(0, Math.floor(((expectedPunchOut > pIn ? expectedPunchOut : pIn) - pIn) / (1000 * 60)));
            dur = Math.min(dur, 1440);
          }
          s.durationMinutes = dur;
          totalWorkingMinutes += dur;
        }
      }

      // Cap totalWorkingMinutes to at most 24 hours (1440 mins)
      totalWorkingMinutes = Math.min(totalWorkingMinutes, 1440);
      const { autoBreaks, totalBreakMinutes } = calculateBreaks(punchSessions);

      // Status determination:
      // Sunday: week_off
      // Full Day (present): at least 5 hours (300 mins)
      // Half Day: at least 3 hours (180 mins) and < 5 hours
      // Absent: below 3 hours
      let newStatus = 'present';
      if (isSunday) {
        newStatus = 'week_off';
      } else if (totalWorkingMinutes >= 300) {
        newStatus = 'present';
      } else if (totalWorkingMinutes >= 180) {
        newStatus = 'half_day';
      } else {
        newStatus = 'absent';
      }

      const updateData = {
        punch_sessions: punchSessions,
        current_session: -1,
        status: newStatus,
        total_working_minutes: totalWorkingMinutes,
        total_break_minutes: totalBreakMinutes,
        auto_breaks: autoBreaks,
        last_punch_out: expectedPunchOut || attendance.last_punch_out,
        shift_id: attendance.shift_id || shift?.id,
        expected_punch_in: attendance.expected_punch_in || expectedPunchIn,
        expected_punch_out: attendance.expected_punch_out || expectedPunchOut,
        admin_remarks: attendance.admin_remarks || 'Auto punched out at shift end time'
      };

      await attendance.update(updateData);
      await attendance.reload();
    }

    return attendance;
  } catch (err) {
    console.error('processAutoPunchOut error:', err);
    return attendance;
  }
};

// Global periodic Auto Punch-Out runner across all active users
const runGlobalAutoPunchOut = async (app) => {
  try {
    const models = app.get('models');
    if (!models || !models.Attendance || !models.User) return;

    const { Attendance, User } = models;
    const todayIST = getISTDate();
    const now = new Date();
    const todayDateObj = new Date(todayIST);
    const isSundayToday = todayDateObj.getDay() === 0;

    // 1. Settle all open sessions across all records
    const openRecords = await Attendance.findAll({
      where: {
        [Op.or]: [
          { current_session: { [Op.gte]: 0 } },
          { status: 'punched_in' },
          { date: { [Op.lt]: todayIST }, last_punch_out: null, first_punch_in: { [Op.ne]: null } },
          { total_working_minutes: { [Op.gt]: 1440 } }
        ]
      }
    });

    for (const record of openRecords) {
      await processAutoPunchOut(record, models, now);
    }

    // 2. Auto-mark Absent (A) for active users who did not punch in after shift end
    const activeUsers = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'employee_code', 'role']
    });

    for (const user of activeUsers) {
      const shift = await getEffectiveUserShift(user.id, todayIST, models);
      const expectedPunchIn = getShiftDateTime(todayIST, shift.start_time || '10:00:00');
      const expectedPunchOut = getShiftDateTime(todayIST, shift.end_time || '18:00:00');
      const isPastShiftEndToday = expectedPunchOut && now >= expectedPunchOut;

      const todayRecord = await Attendance.findOne({
        where: { user_id: user.id, date: todayIST }
      });

      if (!todayRecord) {
        if (isSundayToday) {
          await Attendance.create({
            user_id: user.id,
            date: todayIST,
            shift_id: shift.id || null,
            expected_punch_in: expectedPunchIn,
            expected_punch_out: expectedPunchOut,
            status: 'week_off',
            punch_sessions: [],
            current_session: -1,
            total_working_minutes: 0,
            total_break_minutes: 0,
            admin_remarks: 'Sunday / Week Off'
          });
        } else if (isPastShiftEndToday) {
          await Attendance.create({
            user_id: user.id,
            date: todayIST,
            shift_id: shift.id || null,
            expected_punch_in: expectedPunchIn,
            expected_punch_out: expectedPunchOut,
            status: 'absent',
            punch_sessions: [],
            current_session: -1,
            total_working_minutes: 0,
            total_break_minutes: 0,
            admin_remarks: 'Auto marked absent (No punch-in)'
          });
        }
      } else if (!isSundayToday && isPastShiftEndToday && (!todayRecord.first_punch_in || todayRecord.punch_sessions?.length === 0) && todayRecord.status !== 'on_leave' && todayRecord.status !== 'holiday') {
        if (todayRecord.status !== 'absent') {
          await todayRecord.update({
            status: 'absent',
            total_working_minutes: 0,
            admin_remarks: todayRecord.admin_remarks || 'Auto marked absent (No punch-in)'
          });
        }
      }
    }
  } catch (err) {
    console.warn('runGlobalAutoPunchOut error:', err.message);
  }
};

// GET all attendance records
const getAllAttendance = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance } = models;
    let attendance = await Attendance.findAll({
      include: [
        {
          model: req.app.get('models').User,
          as: 'user',
          attributes: ['id', 'name', 'employee_code']
        },
        {
          model: req.app.get('models').Shift,
          as: 'shift',
          attributes: ['id', 'name', 'start_time', 'end_time', 'minimum_hours', 'half_day_threshold']
        }
      ]
    });

    // Auto-settle any past/unclosed records on demand
    for (let i = 0; i < attendance.length; i++) {
      if (attendance[i].status === 'punched_in' || attendance[i].current_session >= 0) {
        attendance[i] = await processAutoPunchOut(attendance[i], models);
      }
    }

    res.json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET today's attendance for admin dashboard
const getTodayAttendanceForAdmin = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance } = models;
    const today = getISTDate();

    let attendance = await Attendance.findAll({
      where: {
        date: today
      },
      include: [
        {
          model: req.app.get('models').User,
          as: 'user',
          attributes: ['id', 'name', 'employee_code']
        },
        {
          model: req.app.get('models').Shift,
          as: 'shift',
          attributes: ['id', 'name', 'start_time', 'end_time', 'minimum_hours', 'half_day_threshold']
        }
      ]
    });

    // Auto-settle any open sessions if shift end time passed
    for (let i = 0; i < attendance.length; i++) {
      if (attendance[i].status === 'punched_in' || attendance[i].current_session >= 0) {
        attendance[i] = await processAutoPunchOut(attendance[i], models);
      }
    }

    // Calculate summary
    const totalEmployees = await req.app.get('models').User.count({
      where: { is_active: true }
    });

    const presentToday = attendance.filter(a =>
      ['present', 'punched_in'].includes(a.status)
    ).length;

    const absentToday = totalEmployees - presentToday;
    const onBreak = attendance.filter(a => a.status === 'punched_out').length;
    const totalHoursToday = attendance.reduce((sum, a) =>
      sum + (a.total_working_minutes / 60), 0
    );

    const summary = {
      totalEmployees,
      presentToday,
      absentToday,
      onBreak,
      totalHoursToday: Math.round(totalHoursToday * 100) / 100
    };

    const employees = attendance.map(a => ({
      userId: a.user_id,
      name: a.user?.name || 'Unknown',
      employeeCode: a.user?.employee_code || 'N/A',
      department: 'N/A', // Department would require joining with Department model
      attendance: {
        status: a.status,
        totalWorkingMinutes: a.total_working_minutes,
        totalBreakMinutes: a.total_break_minutes,
        punchSessions: a.punch_sessions,
        firstPunchIn: a.first_punch_in,
        lastPunchOut: a.last_punch_out,
        isLate: a.is_late
      },
      hasShiftAssigned: !!a.shift_id,
      shift: a.shift
    }));

    res.json({
      success: true,
      data: {
        summary,
        employees
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET today's attendance for specific user
const getTodayAttendanceForUser = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance } = models;
    const { userId } = req.params;
    const today = getISTDate();

    const shift = await getEffectiveUserShift(userId, today, models);
    const expectedPunchIn = getShiftDateTime(today, shift.start_time);
    const expectedPunchOut = getShiftDateTime(today, shift.end_time);

    let attendance = await Attendance.findOne({
      where: {
        user_id: userId,
        date: today
      },
      include: [
        {
          model: models.Shift,
          as: 'shift',
          attributes: ['id', 'name', 'start_time', 'end_time', 'minimum_hours', 'half_day_threshold']
        }
      ]
    });

    // Auto-settle open session if shift end has passed
    if (attendance) {
      attendance = await processAutoPunchOut(attendance, models);
    }

    // If no attendance record exists for today, return default structure
    if (!attendance) {
      return res.json({
        success: true,
        data: {
          date: today,
          status: 'not_started',
          punchSessions: [],
          currentSession: -1,
          activeSession: null,
          firstPunchIn: null,
          lastPunchOut: null,
          totalWorkingMinutes: 0,
          totalBreakMinutes: 0,
          autoBreaks: [],
          expectedPunchIn,
          expectedPunchOut,
          shift,
          // Legacy fields
          punchIn: null,
          punchOut: null
        }
      });
    }

    // Sync attendance record if assigned shift changed
    if (attendance && shift && shift.id && attendance.shift_id !== shift.id) {
      await attendance.update({
        shift_id: shift.id,
        expected_punch_in: expectedPunchIn,
        expected_punch_out: expectedPunchOut
      });
      attendance.shift_id = shift.id;
      attendance.expected_punch_in = expectedPunchIn;
      attendance.expected_punch_out = expectedPunchOut;
      attendance.shift = shift;
    }

    // Return comprehensive attendance data
    const summaryData = {
      date: attendance.date,
      status: attendance.status,
      punchSessions: attendance.punch_sessions || [],
      currentSession: attendance.current_session,
      activeSession: attendance.current_session >= 0 ?
        attendance.punch_sessions?.[attendance.current_session] : null,
      firstPunchIn: attendance.first_punch_in,
      lastPunchOut: attendance.last_punch_out,
      expectedPunchIn: expectedPunchIn,
      expectedPunchOut: expectedPunchOut,
      shift: shift,
      totalWorkingMinutes: attendance.total_working_minutes || 0,
      totalBreakMinutes: attendance.total_break_minutes || 0,
      autoBreaks: attendance.auto_breaks || [],
      adminRemarks: attendance.admin_remarks,
      // Legacy fields for compatibility
      punchIn: attendance.first_punch_in,
      punchOut: attendance.last_punch_out
    };

    res.json({
      success: true,
      data: summaryData
    });
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET weekly attendance for user
const getWeeklyAttendance = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance } = models;
    const { userId } = req.params;

    // Get current week dates in IST
    const today = new Date(getISTDateTime());
    const currentDay = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      let attendance = await Attendance.findOne({
        where: {
          user_id: userId,
          date: dateStr
        }
      });

      if (attendance && (attendance.status === 'punched_in' || attendance.current_session >= 0)) {
        attendance = await processAutoPunchOut(attendance, models);
      }

      weeklyData.push({
        day: weekDays[i],
        date: dateStr,
        hours: attendance ? Math.round((attendance.total_working_minutes / 60) * 100) / 100 : 0.0,
        hasShiftAssigned: !!attendance?.shift_id
      });
    }

    res.json({
      success: true,
      data: weeklyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET monthly attendance for user
const getMonthlyAttendance = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance } = models;
    const { userId } = req.params;

    // Use query params if provided, otherwise fallback to current month
    const today = new Date(getISTDateTime());
    const year = req.query.year ? parseInt(req.query.year) : today.getFullYear();
    const month = req.query.month ? parseInt(req.query.month) - 1 : today.getMonth(); // month is 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthlyData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      let attendance = await Attendance.findOne({
        where: {
          user_id: userId,
          date: dateStr
        }
      });

      if (attendance && (attendance.status === 'punched_in' || attendance.current_session >= 0)) {
        attendance = await processAutoPunchOut(attendance, models);
      }

      monthlyData.push({
        day,
        date: dateStr,
        hours: attendance ? Math.round((attendance.total_working_minutes / 60) * 100) / 100 : 0.0,
        status: attendance?.status || (new Date(dateStr).getDay() === 0 ? 'week_off' : 'absent'),
        firstPunchIn: attendance?.first_punch_in,
        lastPunchOut: attendance?.last_punch_out,
        totalWorkingMinutes: attendance?.total_working_minutes || 0,
        adminRemarks: attendance?.admin_remarks,
        hasShiftAssigned: !!attendance?.shift_id
      });
    }

    res.json({
      success: true,
      data: monthlyData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET attendance stats for user
const getAttendanceStats = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance } = models;
    const { userId } = req.params;

    // Get current month stats
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const attendanceRecords = await Attendance.findAll({
      where: {
        user_id: userId,
        date: {
          [Op.gte]: startOfMonth.toISOString().split('T')[0],
          [Op.lte]: endOfMonth.toISOString().split('T')[0]
        }
      }
    });

    for (let i = 0; i < attendanceRecords.length; i++) {
      if (attendanceRecords[i].status === 'punched_in' || attendanceRecords[i].current_session >= 0) {
        attendanceRecords[i] = await processAutoPunchOut(attendanceRecords[i], models);
      }
    }

    const stats = {
      presentDays: attendanceRecords.filter(a => ['present', 'punched_in'].includes(a.status)).length,
      absentDays: attendanceRecords.filter(a => a.status === 'absent').length,
      halfDays: attendanceRecords.filter(a => a.status === 'half_day').length,
      totalWorkingMinutes: attendanceRecords.reduce((sum, a) => sum + (a.total_working_minutes || 0), 0)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle punch in/out for user
const togglePunch = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance } = models;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const today = getISTDate();
    const now = getISTDateTime();

    // Settle any unclosed previous days' records for this user first
    const pastOpenRecords = await Attendance.findAll({
      where: {
        user_id: userId,
        date: { [Op.lt]: today },
        [Op.or]: [
          { current_session: { [Op.gte]: 0 } },
          { status: 'punched_in' }
        ]
      }
    });
    for (const pastRec of pastOpenRecords) {
      await processAutoPunchOut(pastRec, models);
    }

    // Resolve effective shift
    const shift = await getEffectiveUserShift(userId, today, models);
    const expectedPunchIn = getShiftDateTime(today, shift.start_time);
    const expectedPunchOut = getShiftDateTime(today, shift.end_time);

    // Check if today is Sunday or Non-working day
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDateObj = new Date(today);
    const dayOfWeek = todayDateObj.getDay(); // 0 = Sunday
    const todayDayName = dayNames[dayOfWeek];
    const isSunday = dayOfWeek === 0;

    const isWorkDay = Array.isArray(shift?.work_days) && shift.work_days.length > 0
      ? shift.work_days.some(d => d.toLowerCase() === todayDayName.toLowerCase())
      : !isSunday;

    let attendance = await Attendance.findOne({
      where: {
        user_id: userId,
        date: today
      }
    });

    // If attempting to punch in on Sunday / Week off, block and do not register
    const isPunchingInAttempt = !attendance || attendance.current_session < 0 || attendance.status !== 'punched_in';
    if (isPunchingInAttempt && (!isWorkDay || isSunday)) {
      return res.status(400).json({
        success: false,
        message: `Today is ${todayDayName} (Week Off). Attendance / Punch-in is not allowed on Sundays or scheduled week offs.`
      });
    }

    // Create attendance record if it doesn't exist
    if (!attendance) {
      attendance = await Attendance.create({
        user_id: userId,
        date: today,
        shift_id: shift.id || null,
        expected_punch_in: expectedPunchIn,
        expected_punch_out: expectedPunchOut,
        status: 'absent',
        punch_sessions: [],
        current_session: -1,
        total_working_minutes: 0,
        total_break_minutes: 0
      });
    }

    const punchSessions = JSON.parse(JSON.stringify(attendance.punch_sessions || []));

    // Ensure all existing durationMinutes are integers
    punchSessions.forEach(session => {
      if (session.durationMinutes && typeof session.durationMinutes === 'number') {
        session.durationMinutes = Math.floor(session.durationMinutes);
      }
    });
    const currentSession = attendance.current_session;

    let action = '';
    let message = '';
    let updateData = {
      shift_id: attendance.shift_id || shift.id || null,
      expected_punch_in: attendance.expected_punch_in || expectedPunchIn,
      expected_punch_out: attendance.expected_punch_out || expectedPunchOut
    };

    // Check if user is currently punched in
    if (currentSession >= 0 && punchSessions[currentSession] && !punchSessions[currentSession].punchOut) {

      // User is punched in, so punch out
      // If punch out is happening after shift end time, cap punchOut at shift end time
      const punchInTime = new Date(punchSessions[currentSession].punchIn);
      const isPastShiftEnd = expectedPunchOut && now > expectedPunchOut;
      const effectivePunchOut = (isPastShiftEnd && expectedPunchOut > punchInTime) ? expectedPunchOut : now;

      punchSessions[currentSession].punchOut = effectivePunchOut;

      // Calculate session duration
      const sessionMinutes = (effectivePunchOut - punchInTime) / (1000 * 60);
      punchSessions[currentSession].durationMinutes = Math.floor(Math.max(0, sessionMinutes));

      action = 'punch-out';
      message = 'Punched out successfully';

      // Calculate total working minutes from all completed sessions
      const totalWorkingMinutes = punchSessions.reduce((sum, session) => {
        const duration = Math.floor(session.durationMinutes || 0);
        return sum + duration;
      }, 0);

      // Determine status based on shift thresholds
      const minHours = shift?.minimum_hours ? parseFloat(shift.minimum_hours) : 8;
      const halfHours = shift?.half_day_threshold ? parseFloat(shift.half_day_threshold) : 4;

      let newStatus = 'punched_out';
      if (totalWorkingMinutes >= minHours * 60) {
        newStatus = 'present';
      } else if (totalWorkingMinutes >= halfHours * 60) {
        newStatus = 'half_day';
      }

      const totalWorkingMinutesInt = Math.floor(Math.max(0, totalWorkingMinutes));

      updateData = {
        ...updateData,
        punch_sessions: punchSessions,
        current_session: -1,
        status: newStatus,
        total_working_minutes: totalWorkingMinutesInt,
        last_punch_out: effectivePunchOut
      };
    } else {

      // User is punched out or not started, so punch in
      const newSession = {
        punchIn: now,
        punchOut: null,
        durationMinutes: 0
      };

      punchSessions.push(newSession);
      action = 'punch-in';
      message = `Punched in successfully (Session ${punchSessions.length})`;

      updateData = {
        ...updateData,
        punch_sessions: punchSessions,
        current_session: punchSessions.length - 1,
        status: 'punched_in'
      };

      // Set first punch in and check lateness if this is the first session
      if (!attendance.first_punch_in) {
        updateData.first_punch_in = now;

        const graceMinutes = shift.grace_period || 15;
        const lateThreshold = expectedPunchIn ? new Date(expectedPunchIn.getTime() + graceMinutes * 60 * 1000) : null;
        if (lateThreshold && now > lateThreshold) {
          updateData.is_late = true;
          updateData.late_by_minutes = Math.floor((now - expectedPunchIn) / (1000 * 60));
        }
      }
    }

    // Calculate break times between sessions
    const { autoBreaks, totalBreakMinutes } = calculateBreaks(punchSessions);

    // Add break information to update data
    updateData.auto_breaks = autoBreaks;
    updateData.total_break_minutes = totalBreakMinutes;

    // Ensure all numeric fields in updateData are integers
    if (updateData.total_working_minutes !== undefined) {
      updateData.total_working_minutes = Math.floor(updateData.total_working_minutes);
    }
    if (updateData.total_break_minutes !== undefined) {
      updateData.total_break_minutes = Math.floor(updateData.total_break_minutes);
    }
    if (updateData.current_session !== undefined) {
      updateData.current_session = Math.floor(updateData.current_session);
    }

    // Update attendance record
    await attendance.update(updateData);
    await attendance.reload();

    // Create summary data
    const summaryData = {
      date: attendance.date,
      status: attendance.status,
      punchSessions: attendance.punch_sessions || [],
      currentSession: attendance.current_session,
      activeSession: attendance.current_session >= 0 ?
        attendance.punch_sessions[attendance.current_session] : null,
      firstPunchIn: attendance.first_punch_in,
      lastPunchOut: attendance.last_punch_out,
      expectedPunchIn: attendance.expected_punch_in || expectedPunchIn,
      expectedPunchOut: attendance.expected_punch_out || expectedPunchOut,
      shift,
      totalWorkingMinutes: attendance.total_working_minutes || 0,
      totalBreakMinutes: attendance.total_break_minutes || 0,
      autoBreaks: attendance.auto_breaks || [],
      // Legacy fields for compatibility
      punchIn: attendance.first_punch_in,
      punchOut: attendance.last_punch_out
    };

    // Emit real-time update via Socket.IO
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${userId}`).emit('attendance-update', {
          type: action,
          data: summaryData
        });
      }
    } catch (socketError) {
      console.warn('Socket.IO emit failed:', socketError.message);
    }

    res.json({
      success: true,
      message,
      action,
      data: summaryData
    });

  } catch (error) {
    console.error('Toggle punch error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle punch',
      error: error.message
    });
  }
};

// GET attendance by ID
const getAttendanceById = async (req, res) => {
  try {
    const { Attendance } = req.app.get('models');
    const attendance = await Attendance.findByPk(req.params.id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }
    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new attendance record
const createAttendance = async (req, res) => {
  try {
    const { Attendance } = req.app.get('models');
    const attendance = await Attendance.create(req.body);
    res.status(201).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE an attendance record
const updateAttendance = async (req, res) => {
  try {
    const { Attendance } = req.app.get('models');
    const attendance = await Attendance.findByPk(req.params.id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    await attendance.update(req.body);
    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE an attendance record
const deleteAttendance = async (req, res) => {
  try {
    const { Attendance } = req.app.get('models');
    const attendance = await Attendance.findByPk(req.params.id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    await attendance.destroy();
    res.json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Upsert Attendance Record
const upsertAttendance = async (req, res) => {
  try {
    const { Attendance } = req.app.get('models');
    const { userId, date, status, totalWorkingMinutes, adminRemarks } = req.body;

    if (!userId || !date) {
      return res.status(400).json({
        success: false,
        message: 'userId and date are required'
      });
    }

    let attendance = await Attendance.findOne({
      where: { user_id: userId, date }
    });

    const updateData = {
      status: status || 'present',
      total_working_minutes: totalWorkingMinutes ? Math.floor(Number(totalWorkingMinutes)) : 0,
      admin_remarks: adminRemarks || null
    };

    if (attendance) {
      await attendance.update(updateData);
    } else {
      attendance = await Attendance.create({
        user_id: userId,
        date,
        ...updateData,
        punch_sessions: [],
        current_session: -1,
        total_break_minutes: 0
      });
    }

    res.json({
      success: true,
      message: 'Attendance saved successfully',
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Get Attendance Report (Date Range)
const getAttendanceReport = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance, User, Shift } = models;
    const { startDate, endDate, userId } = req.query;
    const todayIST = getISTDate();

    // Auto-populate missing past attendance records for active users
    if (startDate && endDate) {
      const activeUsers = await User.findAll({
        where: {
          is_active: true,
          ...(userId && { id: userId })
        },
        attributes: ['id', 'name', 'employee_code', 'role']
      });

      const start = new Date(startDate);
      const endLimit = new Date(endDate < todayIST ? endDate : todayIST);

      for (let cur = new Date(start); cur < new Date(todayIST) && cur <= endLimit; cur.setDate(cur.getDate() + 1)) {
        const dateStr = cur.toISOString().split('T')[0];
        const isSun = cur.getDay() === 0;

        for (const user of activeUsers) {
          const existing = await Attendance.findOne({
            where: { user_id: user.id, date: dateStr }
          });

          if (!existing) {
            const shift = await getEffectiveUserShift(user.id, dateStr, models);
            const expectedPunchIn = getShiftDateTime(dateStr, shift.start_time || '10:00:00');
            const expectedPunchOut = getShiftDateTime(dateStr, shift.end_time || '18:00:00');

            await Attendance.create({
              user_id: user.id,
              date: dateStr,
              shift_id: shift.id || null,
              expected_punch_in: expectedPunchIn,
              expected_punch_out: expectedPunchOut,
              status: isSun ? 'week_off' : 'absent',
              punch_sessions: [],
              current_session: -1,
              total_working_minutes: 0,
              total_break_minutes: 0,
              admin_remarks: isSun ? 'Sunday / Week Off' : 'Auto marked absent (No punch-in)'
            });
          }
        }
      }
    }

    const where = {};
    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    if (userId) {
      where.user_id = userId;
    }

    const records = await Attendance.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'employee_code', 'role']
        },
        {
          model: Shift,
          as: 'shift',
          attributes: ['id', 'name', 'start_time', 'end_time', 'minimum_hours', 'half_day_threshold']
        }
      ],
      order: [['date', 'DESC'], ['created_at', 'DESC']]
    });

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const isSunday = new Date(rec.date).getDay() === 0;

      if (isSunday) {
        if (rec.status !== 'week_off') {
          await rec.update({ status: 'week_off' });
          rec.status = 'week_off';
        }
      } else if (
        rec.status === 'punched_in' ||
        rec.current_session >= 0 ||
        (rec.total_working_minutes || 0) > 1440 ||
        (rec.total_working_minutes >= 300 && rec.status === 'half_day')
      ) {
        records[i] = await processAutoPunchOut(rec, models);
      }
    }

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

// Helper to auto-calculate working hours from shift when admin marks present/half_day
const getShiftWorkingMinutes = async (models, userId, date, status) => {
  try {
    const { UserShift, Shift } = models;
    const userShift = await UserShift.findOne({
      where: { user_id: userId },
      include: [{ model: Shift, as: 'shift' }]
    });

    if (!userShift || !userShift.shift) return { minutes: 0, punchIn: null, punchOut: null };

    const shift = userShift.shift;

    const [startH, startM] = shift.start_time.split(':').map(Number);
    const [endH, endM] = shift.end_time.split(':').map(Number);

    const punchIn = new Date(Date.UTC(
      ...date.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v)),
      startH, startM, 0
    ));
    const punchOut = new Date(Date.UTC(
      ...date.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v)),
      endH, endM, 0
    ));

    if (status === 'present') {
      const minutes = Math.round(parseFloat(shift.minimum_hours) * 60);
      return { minutes, punchIn, punchOut };
    }

    if (status === 'half_day') {
      const halfMinutes = Math.round(parseFloat(shift.half_day_threshold) * 60);
      const halfPunchOut = new Date(punchIn.getTime() + halfMinutes * 60 * 1000);
      return { minutes: halfMinutes, punchIn, punchOut: halfPunchOut };
    }

    return { minutes: 0, punchIn: null, punchOut: null };
  } catch (err) {
    console.error('getShiftWorkingMinutes error:', err.message);
    return { minutes: 0, punchIn: null, punchOut: null };
  }
};

// Admin: Bulk Attendance Update
const bulkUpdateAttendance = async (req, res) => {
  try {
    const { Attendance } = req.app.get('models');
    const models = req.app.get('models');
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'Updates must be an array' });
    }

    const results = [];
    for (const update of updates) {
      const { userId, date, status, adminRemarks } = update;

      // Auto-calculate working hours from shift if status is present or half_day
      let totalWorkingMinutes = 0;
      let firstPunchIn = null;
      let lastPunchOut = null;

      if (status === 'present' || status === 'half_day') {
        const shiftData = await getShiftWorkingMinutes(models, userId, date, status);
        totalWorkingMinutes = shiftData.minutes;
        firstPunchIn = shiftData.punchIn;
        lastPunchOut = shiftData.punchOut;
      }

      let attendance = await Attendance.findOne({
        where: { user_id: userId, date }
      });

      const updateData = {
        status,
        admin_remarks: adminRemarks || null,
        first_punch_in: firstPunchIn,
        last_punch_out: lastPunchOut,
        total_working_minutes: totalWorkingMinutes
      };

      if (attendance) {
        await attendance.update(updateData);
      } else {
        attendance = await Attendance.create({
          user_id: userId,
          date,
          ...updateData,
          punch_sessions: [],
          current_session: -1
        });
      }
      results.push(attendance);
    }

    res.json({ success: true, message: `Successfully updated ${results.length} records`, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET today's attendance status for the logged-in user
const getTodayAttendanceStatus = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Attendance } = models;
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const today = getISTDate();
    const shift = await getEffectiveUserShift(userId, today, models);
    const expectedPunchIn = getShiftDateTime(today, shift.start_time);
    const expectedPunchOut = getShiftDateTime(today, shift.end_time);

    let attendance = await Attendance.findOne({
      where: {
        user_id: userId,
        date: today
      },
      include: [
        {
          model: models.Shift,
          as: 'shift',
          attributes: ['id', 'name', 'start_time', 'end_time', 'minimum_hours', 'half_day_threshold']
        }
      ]
    });

    if (attendance) {
      attendance = await processAutoPunchOut(attendance, models);
    }

    // If no attendance record exists for today, return default structure
    if (!attendance) {
      return res.json({
        success: true,
        data: {
          date: today,
          status: 'not_started',
          punchSessions: [],
          currentSession: -1,
          activeSession: null,
          firstPunchIn: null,
          lastPunchOut: null,
          totalWorkingMinutes: 0,
          totalBreakMinutes: 0,
          autoBreaks: [],
          expectedPunchIn,
          expectedPunchOut,
          shift,
          punchIn: null,
          punchOut: null
        }
      });
    }

    // Sync attendance record if assigned shift changed
    if (attendance && shift && shift.id && attendance.shift_id !== shift.id) {
      await attendance.update({
        shift_id: shift.id,
        expected_punch_in: expectedPunchIn,
        expected_punch_out: expectedPunchOut
      });
      attendance.shift_id = shift.id;
      attendance.expected_punch_in = expectedPunchIn;
      attendance.expected_punch_out = expectedPunchOut;
      attendance.shift = shift;
    }

    // Return comprehensive attendance data
    const summaryData = {
      date: attendance.date,
      status: attendance.status,
      punchSessions: attendance.punch_sessions || [],
      currentSession: attendance.current_session,
      activeSession: attendance.current_session >= 0 ?
        attendance.punch_sessions?.[attendance.current_session] : null,
      firstPunchIn: attendance.first_punch_in,
      lastPunchOut: attendance.last_punch_out,
      expectedPunchIn: expectedPunchIn,
      expectedPunchOut: expectedPunchOut,
      shift: shift,
      totalWorkingMinutes: attendance.total_working_minutes || 0,
      totalBreakMinutes: attendance.total_break_minutes || 0,
      autoBreaks: attendance.auto_breaks || [],
      adminRemarks: attendance.admin_remarks,
      punchIn: attendance.first_punch_in,
      punchOut: attendance.last_punch_out
    };

    res.json({
      success: true,
      data: summaryData
    });
  } catch (error) {
    console.error('Get today attendance status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getTodayAttendanceForAdmin,
  getTodayAttendanceForUser,
  getTodayAttendanceStatus,
  getWeeklyAttendance,
  getMonthlyAttendance,
  getAttendanceStats,
  togglePunch,
  upsertAttendance,
  getAttendanceReport,
  bulkUpdateAttendance,
  calculateBreaks,
  processAutoPunchOut,
  runGlobalAutoPunchOut,
  getEffectiveUserShift,
  getShiftDateTime
};