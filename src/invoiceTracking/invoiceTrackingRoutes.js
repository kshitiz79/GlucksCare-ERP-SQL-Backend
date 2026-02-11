// src/invoiceTracking/invoiceTrackingRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  upload,
  getAllInvoiceTracking,
  getUserInvoiceTracking,
  getInvoiceTrackingById,
  createInvoiceTracking,
  updateInvoiceTracking,
  deleteInvoiceTracking,
  getStockistsForDropdown,
  getInvoiceSignedUrl,
  sendInvoiceEmail
} = require('./invoiceTrackingController');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET routes
router.get('/', getAllInvoiceTracking);
router.get('/user', getUserInvoiceTracking);
router.get('/stockists', getStockistsForDropdown);
router.get('/:id/signed-url', getInvoiceSignedUrl); // Must be before /:id
router.post('/:id/send-email', sendInvoiceEmail);
router.get('/:id', getInvoiceTrackingById);

// POST routes
router.post('/', upload.single('invoice_image'), createInvoiceTracking);

// PUT routes
router.put('/:id', upload.single('invoice_image'), updateInvoiceTracking);

// DELETE routes
router.delete('/:id', deleteInvoiceTracking);


module.exports = router;
