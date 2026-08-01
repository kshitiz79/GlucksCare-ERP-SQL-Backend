// src/webDashboard/webDashboardController.js
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// GET web dashboard data - optimized single API call
const getWebDashboardData = async (req, res) => {
    try {

        const [
            usersCount,
            doctorsCount,
            chemistsCount,
            stockistsCount,
            visitsCount,
            expensesSum,
            ticketsCount,
            invoicesCount,
            usersByRole,
            recentActivities,
            salesTargetsSummary
        ] = await Promise.all([

            sequelize.models.User ? sequelize.models.User.count() : 0,

            // Doctors count
            sequelize.models.Doctor ? sequelize.models.Doctor.count() : 0,

            // Chemists count
            sequelize.models.Chemist ? sequelize.models.Chemist.count() : 0,

            // Stockists count
            sequelize.models.Stockist ? sequelize.models.Stockist.count() : 0,

            // Total Visits count
            sequelize.models.DoctorVisit ? sequelize.models.DoctorVisit.count() : 0,

            // Total Expenses sum
            sequelize.models.Expense ? sequelize.models.Expense.sum('amount') : 0,

            // Tickets count
            sequelize.models.Ticket ? sequelize.models.Ticket.count() : 0,

            // Invoices count
            sequelize.models.InvoiceTracking ? sequelize.models.InvoiceTracking.count() : 0,

            // Users by role
            sequelize.models.User ? sequelize.models.User.findAll({
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
            sequelize.models.DoctorVisit ? sequelize.models.DoctorVisit.findAll({
                limit: 10,
                order: [['created_at', 'DESC']],
                attributes: ['id', 'created_at', 'user_id', 'doctor_id']
            }) : [],

            // Sales targets summary (current month)
            getSalesTargetsSummary()
        ]);

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
            stats: {
                totalUsers: usersCount,
                totalDoctors: doctorsCount,
                totalChemists: chemistsCount,
                totalStockists: stockistsCount,
                totalVisits: visitsCount,
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