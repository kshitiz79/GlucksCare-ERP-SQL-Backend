const { Op } = require('sequelize');

/**
 * Helper function to ensure consistent decimal formatting for summary values
 * Returns a number with exactly one decimal place
 */
const formatSummaryValue = (value) => {
    return Math.round(value * 10) / 10;
};

/**
 * Get comprehensive user dashboard data
 * GET /api/dashboard/user
 */
const getUserDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Get start and end of current month
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

        // Get models from app context
        const { 
            User, 
            DoctorVisit, 
            ChemistVisit, 
            StockistVisit, 
            Expense, 
            SalesTarget,
            Department
        } = req.app.get('models');

        // Parallel data fetching for better performance
        const [
            visitStats,
            expenseData,
            targetData,
            userInfo
        ] = await Promise.all([
            getVisitStatistics(userId, monthStart, monthEnd, req.app.get('models')),
            getExpenseData(userId, monthStart, monthEnd, req.app.get('models')),
            getTargetData(userId, currentMonth, currentYear, req.app.get('models')),
            User.findByPk(userId, {
                attributes: ['id', 'name', 'role'],
                include: [{
                    model: Department,
                    as: 'Department',
                    attributes: ['name']
                }]
            })
        ]);

        // Construct dashboard response
        const dashboardData = {
            user: {
                id: userId,
                name: userInfo.name,
                role: userInfo.role,
                department: userInfo.Department?.name || 'N/A'
            },
            period: {
                month: currentMonth,
                year: currentYear,
                monthName: monthStart.toLocaleDateString('en-US', { month: 'long' })
            },
            visits: {
                doctor: {
                    scheduled: Math.floor(visitStats.doctor.scheduled),
                    confirmed: Math.floor(visitStats.doctor.confirmed),
                    total: Math.floor(visitStats.doctor.total)
                },
                chemist: {
                    scheduled: Math.floor(visitStats.chemist.scheduled),
                    confirmed: Math.floor(visitStats.chemist.confirmed),
                    total: Math.floor(visitStats.chemist.total)
                },
                stockist: {
                    scheduled: Math.floor(visitStats.stockist.scheduled),
                    confirmed: Math.floor(visitStats.stockist.confirmed),
                    total: Math.floor(visitStats.stockist.total)
                },
                total: Math.floor(visitStats.total),
                scheduled: Math.floor(visitStats.scheduled),
                confirmed: Math.floor(visitStats.confirmed),
                submitted: Math.floor(visitStats.submitted),
                approved: Math.floor(visitStats.approved),
                rejected: Math.floor(visitStats.rejected),
                draft: Math.floor(visitStats.draft)
            },
            expenses: {
                total: Math.floor(expenseData.total),
                approved: Math.floor(expenseData.approved),
                pending: Math.floor(expenseData.pending),
                rejected: Math.floor(expenseData.rejected),
                totalAmount: Math.floor(expenseData.totalAmount),
                approvedAmount: Math.floor(expenseData.approvedAmount),
                pendingAmount: Math.floor(expenseData.pendingAmount),
                rejectedAmount: Math.floor(expenseData.rejectedAmount)
            },
            targets: {
                monthlyTarget: Math.floor(targetData.monthlyTarget || 0),
                achieved: Math.floor(targetData.achieved || 0),
                remaining: Math.floor(targetData.remaining || 0),
                achievementPercentage: Math.floor(targetData.achievementPercentage || 0),
                status: targetData.status,
                deadline: targetData.deadline,
                targetMonth: Math.floor(targetData.targetMonth),
                targetYear: Math.floor(targetData.targetYear),
                isCurrentMonth: targetData.isCurrentMonth,
                targetPeriod: targetData.targetPeriod,
                displayMessage: targetData.isCurrentMonth 
                    ? `Current month target (${targetData.targetPeriod || 'N/A'})`
                    : `Latest target: ${targetData.targetPeriod || 'N/A'} (No current month target found)`
            },
            summary: {
                totalActivities: String(formatSummaryValue(visitStats.total)),
                visitCompletionRate: String(formatSummaryValue(visitStats.total > 0 ? ((visitStats.approved / visitStats.total) * 100) : 0)),
                targetAchievement: String(formatSummaryValue(targetData.achievementPercentage || 0)),
                pendingExpenses: String(formatSummaryValue(expenseData.pending || 0)),
                totalExpenseAmount: String(formatSummaryValue(expenseData.totalAmount || 0))
            }
        };

        res.json({
            success: true,
            data: dashboardData,
            message: 'Dashboard data retrieved successfully'
        });

    } catch (error) {
        console.error('Get user dashboard error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch dashboard data'
        });
    }
};

/**
 * Get visit statistics for the user
 */
const getVisitStatistics = async (userId, monthStart, monthEnd, models) => {
    try {
        const { DoctorVisit, ChemistVisit, StockistVisit } = models;

        // Get visits from all three models for the user in the current month
        const [doctorVisits, chemistVisits, stockistVisits] = await Promise.all([
            DoctorVisit.findAll({
                where: {
                    user_id: userId,
                    created_at: { [Op.between]: [monthStart, monthEnd] }
                }
            }),
            ChemistVisit.findAll({
                where: {
                    user_id: userId,
                    created_at: { [Op.between]: [monthStart, monthEnd] }
                }
            }),
            StockistVisit.findAll({
                where: {
                    user_id: userId,
                    created_at: { [Op.between]: [monthStart, monthEnd] }
                }
            })
        ]);

        // Initialize counters
        const stats = {
            doctor: { scheduled: 0, confirmed: 0, total: doctorVisits.length },
            chemist: { scheduled: 0, confirmed: 0, total: chemistVisits.length },
            stockist: { scheduled: 0, confirmed: 0, total: stockistVisits.length },
            total: doctorVisits.length + chemistVisits.length + stockistVisits.length,
            scheduled: 0,
            confirmed: 0,
            submitted: 0,
            approved: 0,
            rejected: 0,
            draft: 0
        };

        // Process doctor visits
        doctorVisits.forEach(visit => {
            if (visit.confirmed) {
                stats.doctor.confirmed++;
                stats.confirmed++;
                stats.approved++; // Map confirmed to approved for backward compatibility
            } else {
                stats.doctor.scheduled++;
                stats.scheduled++;
                stats.draft++; // Map unconfirmed to draft for backward compatibility
            }
        });

        // Process chemist visits
        chemistVisits.forEach(visit => {
            if (visit.confirmed) {
                stats.chemist.confirmed++;
                stats.confirmed++;
                stats.approved++;
            } else {
                stats.chemist.scheduled++;
                stats.scheduled++;
                stats.draft++;
            }
        });

        // Process stockist visits
        stockistVisits.forEach(visit => {
            if (visit.confirmed) {
                stats.stockist.confirmed++;
                stats.confirmed++;
                stats.approved++;
            } else {
                stats.stockist.scheduled++;
                stats.scheduled++;
                stats.draft++;
            }
        });

        return stats;
    } catch (error) {
        console.error('Error fetching visit statistics:', error);
        return {
            doctor: { scheduled: 0, confirmed: 0, total: 0 },
            chemist: { scheduled: 0, confirmed: 0, total: 0 },
            stockist: { scheduled: 0, confirmed: 0, total: 0 },
            total: 0,
            scheduled: 0,
            confirmed: 0,
            submitted: 0,
            approved: 0,
            rejected: 0,
            draft: 0
        };
    }
};

/**
 * Get expense data for the user
 */
const getExpenseData = async (userId, monthStart, monthEnd, models) => {
    try {
        const { Expense } = models;

        const expenses = await Expense.findAll({
            where: {
                user_id: userId,
                created_at: { [Op.between]: [monthStart, monthEnd] }
            }
        });

        const expenseData = {
            total: 0,
            approved: 0,
            pending: 0,
            rejected: 0,
            totalAmount: 0,
            approvedAmount: 0,
            pendingAmount: 0,
            rejectedAmount: 0
        };

        expenses.forEach(expense => {
            const status = expense.status?.toLowerCase() || 'pending';
            const amount = parseFloat(expense.amount) || 0;
            
            expenseData.total++;
            expenseData.totalAmount += amount;

            if (status === 'approved') {
                expenseData.approved++;
                expenseData.approvedAmount += amount;
            } else if (status === 'rejected') {
                expenseData.rejected++;
                expenseData.rejectedAmount += amount;
            } else {
                expenseData.pending++;
                expenseData.pendingAmount += amount;
            }
        });

        return expenseData;
    } catch (error) {
        console.error('Error fetching expense data:', error);
        return {
            total: 0,
            approved: 0,
            pending: 0,
            rejected: 0,
            totalAmount: 0,
            approvedAmount: 0,
            pendingAmount: 0,
            rejectedAmount: 0
        };
    }
};

/**
 * Get target data for the user
 */
const getTargetData = async (userId, month, year, models) => {
    try {
        const { SalesTarget } = models;

        // First try to find target for current month
        let target = await SalesTarget.findOne({
            where: {
                user_id: userId,
                target_month: month,
                target_year: year
            }
        });

        // If no target for current month, find the most recent target
        if (!target) {
            target = await SalesTarget.findOne({
                where: {
                    user_id: userId
                },
                order: [['target_year', 'DESC'], ['target_month', 'DESC']]
            });
        }

        if (!target) {
            return {
                monthlyTarget: 0,
                achieved: 0,
                remaining: 0,
                achievementPercentage: 0,
                status: 'No Target Set',
                targetMonth: month,
                targetYear: year,
                isCurrentMonth: true
            };
        }

        const achieved = parseFloat(target.achieved_amount) || 0;
        const monthlyTarget = parseFloat(target.target_amount) || 0;
        const remaining = Math.max(0, monthlyTarget - achieved);
        const achievementPercentage = monthlyTarget > 0 ? ((achieved / monthlyTarget) * 100) : 0;

        // Check if this is the current month target or a different month
        const isCurrentMonth = target.target_month === month && target.target_year === year;

        return {
            monthlyTarget,
            achieved,
            remaining,
            achievementPercentage: parseFloat(achievementPercentage.toFixed(1)),
            status: target.status || 'Active',
            deadline: target.completion_deadline,
            targetMonth: target.target_month,
            targetYear: target.target_year,
            isCurrentMonth,
            targetPeriod: `${getMonthName(target.target_month)} ${target.target_year}`
        };
    } catch (error) {
        console.error('Error fetching target data:', error);
        return {
            monthlyTarget: 0,
            achieved: 0,
            remaining: 0,
            achievementPercentage: 0,
            status: 'Error',
            targetMonth: month,
            targetYear: year,
            isCurrentMonth: true
        };
    }
};

/**
 * Helper function to get month name
 */
const getMonthName = (monthNumber) => {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNumber - 1] || 'Unknown';
};

module.exports = {
    getUserDashboard
};