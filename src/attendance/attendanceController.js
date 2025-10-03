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
  // Return current UTC time - the database will store it as UTC
  // and the frontend will handle timezone display
  return new Date();
};

// Utility function to calculate breaks between punch sessions
const calculateBreaks = (punchSessions) => {
  const autoBreaks = [];
  let totalBreakMinutes = 0;

  // Only calculate breaks if there are multiple sessions
  if (punchSessions.length > 1) {
    // Loop through sessions to calculate breaks between them
    for (let i = 1; i < punchSessions.length; i++) {
      const previousSession = punchSessions[i - 1];
      const currentSession = punchSessions[i];
      
      // Only calculate break if both sessions are complete (have punch in and punch out)
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

// GET all attendance records
const getAllAttendance = async (req, res) => {
  try {
    const { Attendance } = req.app.get('models');
    const attendance = await Attendance.findAll({
      include: [
        {
          model: req.app.get('models').User,
          as: 'user',
          attributes: ['id', 'name', 'employee_code']
        },
        {
          model: req.app.get('models').Shift,
          as: 'shift',
          attributes: ['id', 'name', 'start_time', 'end_time']
        }
      ]
    });
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
    const { Attendance } = req.app.get('models');
    const today = getISTDate();

    const attendance = await Attendance.findAll({
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
          attributes: ['id', 'name', 'start_time', 'end_time']
        }
      ]
    });

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
    const { Attendance } = req.app.get('models');
    const { userId } = req.params;
    const today = getISTDate();

    let attendance = await Attendance.findOne({
      where: {
        user_id: userId,
        date: today
      }
    });

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
          // Legacy fields
          punchIn: null,
          punchOut: null
        }
      });
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
      totalWorkingMinutes: attendance.total_working_minutes || 0,
      totalBreakMinutes: attendance.total_break_minutes || 0,
      autoBreaks: attendance.auto_breaks || [],
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
    const { Attendance } = req.app.get('models');
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

      const attendance = await Attendance.findOne({
        where: {
          user_id: userId,
          date: dateStr
        }
      });

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
    const { Attendance } = req.app.get('models');
    const { userId } = req.params;

    // Get current month dates in IST
    const today = new Date(getISTDateTime());
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthlyData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      // Ensure we get the correct date string in IST context
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const attendance = await Attendance.findOne({
        where: {
          user_id: userId,
          date: dateStr
        }
      });

      monthlyData.push({
        day,
        date: dateStr,
        hours: attendance ? Math.round((attendance.total_working_minutes / 60) * 100) / 100 : 0.0,
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
    const { Attendance } = req.app.get('models');
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
    const { Attendance } = req.app.get('models');
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const today = getISTDate();
    const now = getISTDateTime();

    let attendance = await Attendance.findOne({
      where: {
        user_id: userId,
        date: today
      }
    });

    // Create attendance record if it doesn't exist
    if (!attendance) {
      attendance = await Attendance.create({
        user_id: userId,
        date: today,
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
    let updateData = {};

    // Check if user is currently punched in
    if (currentSession >= 0 && punchSessions[currentSession] && !punchSessions[currentSession].punchOut) {

      // User is punched in, so punch out
      punchSessions[currentSession].punchOut = now;

      // Calculate session duration
      const punchIn = new Date(punchSessions[currentSession].punchIn);
      const sessionMinutes = (now - punchIn) / (1000 * 60);
      punchSessions[currentSession].durationMinutes = Math.floor(Math.max(0, sessionMinutes));

      action = 'punch-out';
      message = 'Punched out successfully';

      // Calculate total working minutes from all completed sessions
      const totalWorkingMinutes = punchSessions.reduce((sum, session) => {
        const duration = Math.floor(session.durationMinutes || 0);
        return sum + duration;
      }, 0);

      // Determine status based on working hours
      let newStatus = 'punched_out';
      if (totalWorkingMinutes >= 480) { // 8 hours
        newStatus = 'present';
      } else if (totalWorkingMinutes >= 240) { // 4 hours
        newStatus = 'half_day';
      }

      // Ensure all numeric values are integers
      const totalWorkingMinutesInt = Math.floor(Math.max(0, totalWorkingMinutes));

      updateData = {
        punch_sessions: punchSessions,
        current_session: -1,
        status: newStatus,
        total_working_minutes: totalWorkingMinutesInt,
        last_punch_out: now
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
        punch_sessions: punchSessions,
        current_session: punchSessions.length - 1,
        status: 'punched_in'
      };

      // Set first punch in if this is the first session
      if (!attendance.first_punch_in) {
        updateData.first_punch_in = now;
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

    // Reload to get fresh data
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

module.exports = {
  getAllAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getTodayAttendanceForAdmin,
  getTodayAttendanceForUser,
  getWeeklyAttendance,
  getMonthlyAttendance,
  getAttendanceStats,
  togglePunch,
  calculateBreaks // Export for testing
};