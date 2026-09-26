// src/voucher/voucherRoutes.js
const express = require('express');
const router = express.Router();
const voucherController = require('./voucherController');
const { verifyToken } = require('../middleware/authMiddleware');

// Mount routes with authentication
router.use(verifyToken);

// 1. Get unpaid invoices for a specific stockist
router.get('/unpaid-invoices/:stockistId', voucherController.getUnpaidInvoicesByStockist);

// 2. Get advance balance and history for a stockist
router.get('/stockist-advance/:stockistId', voucherController.getStockistAdvanceDetails);

// 3. Get all vouchers (paginated, filtered)
router.get('/', voucherController.getVouchers);

// 4. Get single voucher by ID
router.get('/:id', voucherController.getVoucherById);

// 5. Create a new payment voucher
router.post('/', voucherController.createVoucher);

module.exports = router;
