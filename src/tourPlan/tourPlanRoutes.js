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
  sendCollaborationRequest,
  respondToCollaboration,
  requestDayChange,
  getPendingChangeRequests,
  respondToDayChangeRequest,
  updateDayCollaboration,
  performJointWorkHandshake,
  getAdminHandshakeData,
  deletePlan
} = require('./tourPlanControllers');

const {
  getAsmHeadOfficesOverview,
  getAsmDateUsersOverview,
  saveAsmTourPlanDraft,
  updateAsmPlanDay,
  getAsmPlan,
  submitAsmTourPlan,
  getMyAsmPlans,
  getAsmRsmCoworkers,
  addOrUpdateCoWorkWithRsm,
  respondToCoWorkRequest
} = require('./asmTourPlanControllers');

const { ensureTourPlanSchema } = require('./ensureTourPlanSchema');

// All routes require authentication
router.use(authMiddleware);

// Automatic schema guarantee for tour plan routes on all databases/tenants
router.use(async (req, res, next) => {
  try {
    const s = req?.tenantSequelize || (req?.app && typeof req.app.get === 'function' && req.app.get('sequelize')) || require('../config/database').sequelize;
    if (s) {
      await ensureTourPlanSchema(s);
    }
  } catch (e) {
    // Non-blocking fallback
  }
  next();
});

// ASM / Manager Level Tour Plan & HQ routes
router.post('/asm/users-by-date', getAsmDateUsersOverview);
router.get('/asm/users-by-date', getAsmDateUsersOverview);
router.post('/asm/date-users', getAsmDateUsersOverview);
router.get('/asm/date-users', getAsmDateUsersOverview);
router.post('/asm/date-areas', getAsmDateUsersOverview);
router.get('/asm/date-areas', getAsmDateUsersOverview);
router.get('/asm/assigned-hqs', getAsmHeadOfficesOverview);
router.post('/asm/assigned-hqs', getAsmHeadOfficesOverview);
router.get('/asm/hqs', getAsmHeadOfficesOverview);
router.post('/asm/hqs', getAsmHeadOfficesOverview);
router.get('/asm/rsm-coworkers', getAsmRsmCoworkers);
router.get('/asm/my-plans', getMyAsmPlans);
router.get('/asm/plan', getAsmPlan);
router.get('/asm/plan/:id', getAsmPlan);
router.post('/asm/draft', saveAsmTourPlanDraft);
router.put('/asm/day/:dayId', updateAsmPlanDay);
router.put('/asm/day', updateAsmPlanDay);
router.post('/asm/day/:dayId/co-work', addOrUpdateCoWorkWithRsm);
router.post('/asm/day/:dayId/co-work-respond', respondToCoWorkRequest);
router.post('/asm/:id/submit', submitAsmTourPlan);
router.post('/asm/submit', submitAsmTourPlan);

// Collaboration and availability routes
router.get('/users/availability', getUsersAvailability);
router.get('/collaboration/incoming', getIncomingCollaborations);
router.get('/collaboration/accepted', getAcceptedCollaborations);
router.post('/collaboration/send', sendCollaborationRequest);
router.post('/collaboration/:dayId/respond', respondToCollaboration);
router.post('/day/:dayId/collaboration', updateDayCollaboration);
router.post('/day/:dayId/handshake', performJointWorkHandshake);
router.get('/admin/handshakes', getAdminHandshakeData);

// Approval and list routes
router.get('/pending-approvals', getPendingApprovals);
router.get('/pending-change-requests', getPendingChangeRequests);
router.get('/admin/all', adminAuth, getAllPlansAdmin);

// Change request actions
router.post('/day/:dayId/change-request', requestDayChange);
router.post('/day/:dayId/respond-change-request', respondToDayChangeRequest);

// Standard operations
router.get('/', getMyPlans);
router.get('/:id', getPlanById);
router.post('/draft', saveDraft);
router.post('/:id/submit', submitPlan);
router.post('/:id/approve', approvePlan);
router.post('/:id/return', returnPlan);
router.delete('/:id', deletePlan);

module.exports = router;
