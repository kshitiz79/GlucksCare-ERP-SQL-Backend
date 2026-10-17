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
  saveAsmTourPlanDraft,
  updateAsmPlanDay,
  getAsmPlan,
  submitAsmTourPlan,
  getMyAsmPlans,
  getAsmRsmCoworkers,
  addOrUpdateCoWorkWithRsm,
  respondToCoWorkRequest
} = require('./asmTourPlanControllers');

// All routes require authentication
router.use(authMiddleware);

// ASM / Manager Level Tour Plan & HQ routes
router.get('/asm/assigned-hqs', getAsmHeadOfficesOverview);
router.get('/asm/hqs', getAsmHeadOfficesOverview);
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
