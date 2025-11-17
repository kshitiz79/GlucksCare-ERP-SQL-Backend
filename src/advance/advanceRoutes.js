// Advance Routes
const express = require('express');
const router = express.Router();
const advanceController = require('./advanceController');
const { authMiddleware, authorize } = require('../middleware/authMiddleware');

// User routes - All authenticated users can request advances
router.post('/request', authMiddleware, advanceController.createAdvance);
router.get('/my-advances', authMiddleware, advanceController.getMyAdvances);

// Admin routes - Only admins can manage advances
router.post('/create-by-admin', authMiddleware, authorize('Super Admin', 'Admin', 'Opps Team'), advanceController.createAdvanceByAdmin);
router.get('/', authMiddleware, authorize('Super Admin', 'Admin', 'Opps Team'), advanceController.getAllAdvances);
router.get('/statistics', authMiddleware, authorize('Super Admin', 'Admin', 'Opps Team'), advanceController.getStatistics);
router.get('/:id', authMiddleware, advanceController.getAdvanceById);
router.put('/:id/status', authMiddleware, authorize('Super Admin', 'Admin', 'Opps Team'), advanceController.updateAdvanceStatus);
router.post('/repayment', authMiddleware, authorize('Super Admin', 'Admin', 'Opps Team'), advanceController.addRepayment);
router.get('/:advanceId/repayments', authMiddleware, advanceController.getRepaymentHistory);
router.delete('/:id', authMiddleware, authorize('Super Admin', 'Admin'), advanceController.deleteAdvance);

module.exports = router;
