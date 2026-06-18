const express = require('express');
const router = express.Router();
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');
const {
  getMyPlans,
  getPlanById,
  saveDraft,
  submitPlan,
  approvePlan,
  returnPlan,
  getPendingApprovals,
  getAllPlansAdmin,
  getUsersAvailability,
  getIncomingCollaborations,
  getAcceptedCollaborations,
  respondToCollaboration
} = require('./tourPlanControllers');

// All routes require authentication
router.use(authMiddleware);

// Collaboration and availability routes
router.get('/users/availability', getUsersAvailability);
router.get('/collaboration/incoming', getIncomingCollaborations);
router.get('/collaboration/accepted', getAcceptedCollaborations);
router.post('/collaboration/:dayId/respond', respondToCollaboration);

// Approval and list routes
router.get('/pending-approvals', getPendingApprovals);
router.get('/admin/all', adminAuth, getAllPlansAdmin);

// Standard operations
router.get('/', getMyPlans);
router.get('/:id', getPlanById);
router.post('/draft', saveDraft);
router.post('/:id/submit', submitPlan);
router.post('/:id/approve', approvePlan);
router.post('/:id/return', returnPlan);

module.exports = router;
