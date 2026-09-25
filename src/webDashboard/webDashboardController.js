// src/webDashboard/webDashboardController.js
const { Op } = require('sequelize');

const getModels = (req) => req.db || (req.app && req.app.get('models')) || require('../config/database');
const getSequelize = (req) => req.tenantSequelize || (req.app && req.app.get('sequelize')) || require('../config/database').sequelize;

// Helper to get IST Date strings for periods
const getPeriodDateRange = (period) => {
    const now = new Date();
    // Get current IST date string YYYY-MM-DD
    const istDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);

    if (period === 'today') {
        return {
            startDate: istDateStr,
            endDate: istDateStr,
            isDateRange: true
        };
    }

    if (period === 'week') {
        const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const day = istNow.getDay(); // 0 is Sun, 1 is Mon
        const diff = istNow.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(istNow.setDate(diff));
        const mondayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(monday);
        return {
            startDate: mondayStr,
            endDate: istDateStr,
            isDateRange: true
        };
    }

    if (period === 'month') {
        const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const firstDay = new Date(istNow.getFullYear(), istNow.getMonth(), 1);
        const firstDayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(firstDay);
        return {
            startDate: firstDayStr,
            endDate: istDateStr,
            isDateRange: true
        };
    }

    return {
        startDate: null,
        endDate: null,
        isDateRange: false
    };
};

// GET web dashboard data - optimized single API call with period filtering
const getWebDashboardData = async (req, res) => {
    try {
        const models = getModels(req);
        const sequelize = getSequelize(req);
        const { period = 'all', startDate: customStart, endDate: customEnd } = req.query;

        let dateRange = { startDate: null, endDate: null, isDateRange: false };
        if (customStart && customEnd) {
            dateRange = { startDate: customStart, endDate: customEnd, isDateRange: true };
        } else if (period && period !== 'all') {
            dateRange = getPeriodDateRange(period);
        }

        const dateWhere = dateRange.isDateRange
            ? { date: { [Op.between]: [dateRange.startDate, dateRange.endDate] } }
            : {};

        const expenseWhere = dateRange.isDateRange
            ? { date: { [Op.between]: [dateRange.startDate, dateRange.endDate] } }
            : {};

        const invoiceWhere = dateRange.isDateRange
            ? { invoice_date: { [Op.between]: [dateRange.startDate, dateRange.endDate] } }
            : {};

        const ticketWhere = dateRange.isDateRange
            ? { created_at: { [Op.between]: [`${dateRange.startDate} 00:00:00+05:30`, `${dateRange.endDate} 23:59:59+05:30`] } }
            : {};

        const [
            usersCount,
            doctorsCount,
            chemistsCount,
            stockistsCount,
            drVisitsCount,
            chemVisitsCount,
            stkVisitsCount,
            expensesSum,
            ticketsCount,
            invoicesCount,
            usersByRole,
            recentActivities,
            salesTargetsSummary
        ] = await Promise.all([
            models.User ? models.User.count() : 0,

            // Doctors count
            models.Doctor ? models.Doctor.count() : 0,

            // Chemists count
            models.Chemist ? models.Chemist.count() : 0,

            // Stockists count
            models.Stockist ? models.Stockist.count() : 0,

            // Visits counts by type
            models.DoctorVisit ? models.DoctorVisit.count({ where: dateWhere }) : 0,
            models.ChemistVisit ? models.ChemistVisit.count({ where: dateWhere }) : 0,
            models.StockistVisit ? models.StockistVisit.count({ where: dateWhere }) : 0,

            // Total Expenses sum
            models.Expense ? models.Expense.sum('amount', { where: expenseWhere }) : 0,

            // Tickets count
            models.Ticket ? models.Ticket.count({ where: ticketWhere }) : 0,

            // Invoices count
            models.InvoiceTracking ? models.InvoiceTracking.count({ where: invoiceWhere }) : 0,

            // Users by role
            models.User ? models.User.findAll({
                where: {
                    is_active: true
                },
                attributes: [
                    'role',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['role'],
                raw: true
            }) : [],

            // Recent activities (last 10)
            models.DoctorVisit ? models.DoctorVisit.findAll({
                limit: 10,
                order: [['created_at', 'DESC']],
                attributes: ['id', 'created_at', 'user_id', 'doctor_id']
            }) : [],

            // Sales targets summary (current month)
            getSalesTargetsSummary(models)
        ]);

        const totalVisits = (drVisitsCount || 0) + (chemVisitsCount || 0) + (stkVisitsCount || 0);

        // Transform users by role to object
        const roleStats = {};
        if (Array.isArray(usersByRole)) {
            usersByRole.forEach(item => {
                roleStats[item.role] = parseInt(item.count);
            });
        }

        // Transform recent activities (simplified)
        const activities = (recentActivities || []).map(visit => ({
            id: visit.id,
            type: 'doctor_visit',
            description: `Doctor visit recorded`,
            timestamp: visit.created_at,
            userId: visit.user_id,
            doctorId: visit.doctor_id
        }));

        // Prepare response data
        const dashboardData = {
            period,
            dateRange: dateRange.isDateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : null,
            stats: {
                totalUsers: usersCount,
                totalDoctors: doctorsCount,
                totalChemists: chemistsCount,
                totalStockists: stockistsCount,
                totalVisits: totalVisits || (drVisitsCount || 0),
                drVisits: drVisitsCount || 0,
                chemVisits: chemVisitsCount || 0,
                stkVisits: stkVisitsCount || 0,
                totalExpenses: expensesSum || 0,
                totalOrders: invoicesCount || 0,
                totalTickets: ticketsCount,
                usersByRole: roleStats
            },
            recentActivities: activities,
            salesTargets: salesTargetsSummary,
            lastUpdated: new Date().toISOString()
        };

        res.json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('Web dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
};

// Helper function to get sales targets summary
const getSalesTargetsSummary = async (models) => {
    try {
        if (!models || !models.SalesTarget) {
            return {
                totalTargets: 0,
                completedTargets: 0,
                totalTargetAmount: 0,
                totalAchievedAmount: 0,
                achievementPercentage: 0,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear()
            };
        }

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const [totalTargets, completedTargets, totalTargetAmount, totalAchievedAmount] = await Promise.all([
            // Total targets this month
            models.SalesTarget.count({
                where: {
                    target_month: currentMonth,
                    target_year: currentYear
                }
            }),

            // Completed targets this month
            models.SalesTarget.count({
                where: {
                    target_month: currentMonth,
                    target_year: currentYear,
                    status: 'Completed'
                }
            }),

            // Total target amount this month
            models.SalesTarget.sum('target_amount', {
                where: {
                    target_month: currentMonth,
                    target_year: currentYear
                }
            }),

            // Total achieved amount this month
            models.SalesTarget.sum('achieved_amount', {
                where: {
                    target_month: currentMonth,
                    target_year: currentYear
                }
            })
        ]);

        const achievementPercentage = totalTargetAmount > 0
            ? Math.round((totalAchievedAmount / totalTargetAmount) * 100)
            : 0;

        return {
            totalTargets: totalTargets || 0,
            completedTargets: completedTargets || 0,
            totalTargetAmount: totalTargetAmount || 0,
            totalAchievedAmount: totalAchievedAmount || 0,
            achievementPercentage,
            month: currentMonth,
            year: currentYear
        };
    } catch (error) {
        console.error('Sales targets summary error:', error);
        return {
            totalTargets: 0,
            completedTargets: 0,
            totalTargetAmount: 0,
            totalAchievedAmount: 0,
            achievementPercentage: 0,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
        };
    }
};

// GET quick stats only (for faster loading)
const getQuickStats = async (req, res) => {
    try {
        const models = getModels(req);
        const [usersCount, doctorsCount, chemistsCount, stockistsCount] = await Promise.all([
            models.User ? models.User.count() : 0,
            models.Doctor ? models.Doctor.count() : 0,
            models.Chemist ? models.Chemist.count() : 0,
            models.Stockist ? models.Stockist.count() : 0
        ]);

        res.json({
            success: true,
            data: {
                totalUsers: usersCount,
                totalDoctors: doctorsCount,
                totalChemists: chemistsCount,
                totalStockists: stockistsCount
            }
        });
    } catch (error) {
        console.error('Quick stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quick stats'
        });
    }
};

module.exports = {
    getWebDashboardData,
    getQuickStats
};