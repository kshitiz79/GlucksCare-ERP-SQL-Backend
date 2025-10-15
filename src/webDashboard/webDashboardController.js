// src/webDashboard/webDashboardController.js
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// GET web dashboard data - optimized single API call
const getWebDashboardData = async (req, res) => {
    try {
        // Get all data in parallel for better performance
        const [
            usersCount,
            doctorsCount,
            chemistsCount,
            stockistsCount,
            visitsCount,
            expensesSum,
            ticketsCount,
            usersByRole,
            recentActivities,
            salesTargetsSummary
        ] = await Promise.all([
            // Users count
            sequelize.models.User.count(),

            // Doctors count
            sequelize.models.Doctor.count(),

            // Chemists count
            sequelize.models.Chemist.count(),

            // Stockists count
            sequelize.models.Stockist.count(),

            // Visits count (current month)
            sequelize.models.DoctorVisit.count({
                where: {
                    created_at: {
                        [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                    }
                }
            }),

            // Expenses sum (current month)
            sequelize.models.Expense.sum('amount', {
                where: {
                    created_at: {
                        [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                    }
                }
            }),

            // Tickets count
            sequelize.models.Ticket.count(),

            // Users by role
            sequelize.models.User.findAll({
                attributes: [
                    'role',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['role'],
                raw: true
            }),

            // Recent activities (last 10) - simplified to avoid association issues
            sequelize.models.DoctorVisit.findAll({
                limit: 10,
                order: [['created_at', 'DESC']],
                attributes: ['id', 'created_at', 'user_id', 'doctor_id']
            }),

            // Sales targets summary (current month)
            getSalesTargetsSummary()
        ]);

        // Transform users by role to object
        const roleStats = {};
        usersByRole.forEach(item => {
            roleStats[item.role] = parseInt(item.count);
        });

        // Transform recent activities (simplified)
        const activities = recentActivities.map(visit => ({
            id: visit.id,
            type: 'doctor_visit',
            description: `Doctor visit recorded`,
            timestamp: visit.created_at,
            userId: visit.user_id,
            doctorId: visit.doctor_id
        }));

        // Prepare response data
        const dashboardData = {
            stats: {
                totalUsers: usersCount,
                totalDoctors: doctorsCount,
                totalChemists: chemistsCount,
                totalStockists: stockistsCount,
                totalVisits: visitsCount,
                totalExpenses: expensesSum || 0,
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
const getSalesTargetsSummary = async () => {
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const [totalTargets, completedTargets, totalTargetAmount, totalAchievedAmount] = await Promise.all([
            // Total targets this month
            sequelize.models.SalesTarget.count({
                where: {
                    target_month: currentMonth,
                    target_year: currentYear
                }
            }),

            // Completed targets this month
            sequelize.models.SalesTarget.count({
                where: {
                    target_month: currentMonth,
                    target_year: currentYear,
                    status: 'Completed'
                }
            }),

            // Total target amount this month
            sequelize.models.SalesTarget.sum('target_amount', {
                where: {
                    target_month: currentMonth,
                    target_year: currentYear
                }
            }),

            // Total achieved amount this month
            sequelize.models.SalesTarget.sum('achieved_amount', {
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
        const [usersCount, doctorsCount, chemistsCount, stockistsCount] = await Promise.all([
            sequelize.models.User.count(),
            sequelize.models.Doctor.count(),
            sequelize.models.Chemist.count(),
            sequelize.models.Stockist.count()
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