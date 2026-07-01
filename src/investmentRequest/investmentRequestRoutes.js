const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  createInvestmentRequest,
  updateInvestmentRequest,
  getInvestmentRequests,
  getInvestmentRequestsByHeadOffice,
  approveInvestmentRequest,
  rejectInvestmentRequest
} = require('./investmentRequestController');

// CREATE or SAVE draft investment request
router.post('/', authMiddleware, upload.single('paymentProof'), createInvestmentRequest);

// EDIT / SUBMIT draft request
router.put('/:id', authMiddleware, upload.single('paymentProof'), updateInvestmentRequest);

// GET all/filtered investment requests
router.get('/', authMiddleware, getInvestmentRequests);

// GET investment requests by head office (for managers/team leads)
router.get('/by-head-office', authMiddleware, getInvestmentRequestsByHeadOffice);

// APPROVE request
router.put('/:id/approve', authMiddleware, approveInvestmentRequest);

// REJECT request
router.put('/:id/reject', authMiddleware, rejectInvestmentRequest);

module.exports = router;
