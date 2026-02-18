// src/dashboard/logisticsDashboardController.js
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Get Logistics dashboard data
 * GET /api/dashboard/logistics
 */
const getLogisticsDashboard = async (req, res) => {
    try {
        const { ForwardingNote, InvoiceTracking } = req.app.get('models');

        // Parallel data fetching for stats
        const [
            activeShipmentsCount,
            deliveredCount,
            totalLocations,
            recentForwardingNotes
        ] = await Promise.all([
            // Active Shipments (Shipped or In Transit)
            InvoiceTracking.count({
                where: {
                    status: {
                        [Op.in]: ['shipped', 'in_transit']
                    }
                }
            }),

            // Total Delivered
            InvoiceTracking.count({
                where: {
                    status: 'delivered'
                }
            }),

            // Unique Delivery Locations from Forwarding Note
            ForwardingNote.count({
                distinct: true,
                col: 'destination'
            }),

            // Recent Forwarding Notes
            ForwardingNote.findAll({
                limit: 5,
                order: [['created_at', 'DESC']],
                attributes: ['id', 'serial_no', 'customer_name', 'destination', 'created_at']
            })
        ]);

        const dashboardData = {
            stats: {
                activeShipments: activeShipmentsCount,
                totalDelivered: deliveredCount,
                deliveryLocations: totalLocations,
                pendingInvoices: await InvoiceTracking.count({ where: { status: 'pending' } })
            },
            recentActivities: recentForwardingNotes.map(note => ({
                id: note.id,
                type: 'forwarding_note',
                title: `Note #${note.serial_no}`,
                description: `Created for ${note.customer_name}`,
                timestamp: note.created_at,
                destination: note.destination
            })),
            lastUpdated: new Date().toISOString()
        };

        res.json({
            success: true,
            data: dashboardData,
            message: 'Logistics dashboard data retrieved successfully'
        });

    } catch (error) {
        console.error('Get logistics dashboard error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch logistics dashboard data'
        });
    }
};

module.exports = {
    getLogisticsDashboard
};
