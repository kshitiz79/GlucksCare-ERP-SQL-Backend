// src/voucher/voucherController.js
const { Op, fn, col } = require('sequelize');

// Helper to resolve models dynamically across single or multi-tenant context
const getModels = (req) => {
  let models = req.app?.get('models');
  if (!models && req.tenantDb?.models) {
    models = req.tenantDb.models;
  }
  const sequelize = req.tenantDb || req.app?.get('sequelize');
  
  if (!models) {
    models = {};
  }
  
  // Ensure Voucher models exist on models object
  if (!models.Voucher && sequelize) {
    models.Voucher = require('./Voucher')(sequelize);
    models.VoucherPaymentAllocation = require('./VoucherPaymentAllocation')(sequelize);
    models.StockistAdvanceTransaction = require('./StockistAdvanceTransaction')(sequelize);
    models.InvoiceTracking = require('../invoiceTracking/InvoiceTracking')(sequelize);
    models.Stockist = require('../stockist/Stockist')(sequelize);
    models.Bank = require('../bankMaster/Bank')(sequelize);
    models.User = require('../user/User').User ? require('../user/User').User(sequelize) : null;
  }
  
  return { models, sequelize };
};

// Helper to compute available stockist advance balance
const calculateStockistAdvanceBalance = async (StockistAdvanceTransaction, stockistId, transaction = null) => {
  const credits = await StockistAdvanceTransaction.sum('amount', {
    where: { stockist_id: stockistId, type: 'credit' },
    transaction
  }) || 0;

  const debits = await StockistAdvanceTransaction.sum('amount', {
    where: { stockist_id: stockistId, type: 'debit' },
    transaction
  }) || 0;

  return Math.max(0, parseFloat((credits - debits).toFixed(2)));
};

// Helper to ensure voucher tables exist dynamically on the active database connection
const ensureVoucherTables = async (sequelize) => {
  if (!sequelize) return;
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_number VARCHAR(100) NOT NULL UNIQUE,
        voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
        voucher_type VARCHAR(50) DEFAULT 'receipt',
        stockist_id UUID NOT NULL REFERENCES stockists(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        party_name VARCHAR(255) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL DEFAULT 'Cash',
        bank_id UUID REFERENCES master_banks(id) ON UPDATE CASCADE ON DELETE SET NULL,
        reference_number VARCHAR(100),
        amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        allocated_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        advance_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        used_advance_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'posted',
        remarks TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS voucher_payment_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_id UUID NOT NULL REFERENCES vouchers(id) ON UPDATE CASCADE ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES invoice_tracking(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        allocated_amount DECIMAL(15, 2) NOT NULL,
        notes VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS stockist_advance_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stockist_id UUID NOT NULL REFERENCES stockists(id) ON UPDATE CASCADE ON DELETE CASCADE,
        voucher_id UUID REFERENCES vouchers(id) ON UPDATE CASCADE ON DELETE SET NULL,
        invoice_id UUID REFERENCES invoice_tracking(id) ON UPDATE CASCADE ON DELETE SET NULL,
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        balance_after DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        description TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  } catch (err) {
    // Tables might already exist
  }
};

// 1. Get unpaid / outstanding invoices for a stockist
exports.getUnpaidInvoicesByStockist = async (req, res) => {
  try {
    const { models, sequelize } = getModels(req);
    await ensureVoucherTables(sequelize);

    const { InvoiceTracking, VoucherPaymentAllocation, Stockist } = models;
    const { stockistId } = req.params;

    if (!stockistId) {
      return res.status(400).json({ success: false, message: 'Stockist ID is required' });
    }

    const stockist = await Stockist.findByPk(stockistId);
    if (!stockist) {
      return res.status(404).json({ success: false, message: 'Stockist not found' });
    }

    // Build flexible where clause matching either stockist_id or party_name
    const whereClause = {
      [Op.and]: [
        {
          [Op.or]: [
            { stockist_id: stockistId },
            ...(stockist.firm_name ? [{ party_name: { [Op.iLike]: stockist.firm_name.trim() } }] : [])
          ]
        },
        {
          status: { [Op.ne]: 'cancelled' }
        }
      ]
    };

    // Fetch all active invoices for this stockist
    const invoices = await InvoiceTracking.findAll({
      where: whereClause,
      order: [
        ['invoice_date', 'ASC'],
        ['created_at', 'ASC']
      ]
    });

    // Safely collect payment allocations
    const allocationMap = {};
    if (invoices.length > 0 && VoucherPaymentAllocation) {
      try {
        const invoiceIds = invoices.map((i) => i.id);
        const allocs = await VoucherPaymentAllocation.findAll({
          where: { invoice_id: { [Op.in]: invoiceIds } },
          attributes: ['invoice_id', 'allocated_amount']
        });
        for (const a of allocs) {
          allocationMap[a.invoice_id] = (allocationMap[a.invoice_id] || 0) + parseFloat(a.allocated_amount || 0);
        }
      } catch (allocErr) {
        console.warn('Could not query voucher payment allocations:', allocErr.message);
      }
    }

    const unpaidInvoices = [];

    for (const inv of invoices) {
      let invTotal = parseFloat(inv.amount || 0);
      // Fallback calculation if amount was not directly populated
      if (invTotal <= 0 && inv.taxable_amount) {
        const taxable = parseFloat(inv.taxable_amount || 0);
        const discount = parseFloat(inv.discount_amount || 0);
        const gstPct = parseFloat(inv.gst_percent || 5);
        const taxableAfterDiscount = Math.max(0, taxable - discount);
        const gstAmount = (taxableAfterDiscount * gstPct) / 100;
        invTotal = parseFloat((taxableAfterDiscount + gstAmount).toFixed(2));
      }

      const paidTotal = allocationMap[inv.id] || 0;
      const remainingBalance = parseFloat(Math.max(0, invTotal - paidTotal).toFixed(2));

      // Only include invoices that have an outstanding balance > 0
      if (remainingBalance > 0.009 || invTotal === 0) {
        unpaidInvoices.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          party_name: inv.party_name || stockist.firm_name,
          stockist_id: inv.stockist_id,
          total_amount: invTotal,
          taxable_amount: parseFloat(inv.taxable_amount || 0),
          discount_amount: parseFloat(inv.discount_amount || 0),
          paid_amount: parseFloat(paidTotal.toFixed(2)),
          remaining_balance: remainingBalance > 0 ? remainingBalance : invTotal,
          status: inv.status,
          remarks: inv.remarks
        });
      }
    }

    // Also get current available advance for this stockist
    let advanceBalance = 0;
    try {
      if (models.StockistAdvanceTransaction) {
        advanceBalance = await calculateStockistAdvanceBalance(
          models.StockistAdvanceTransaction,
          stockistId
        );
      }
    } catch (e) {
      advanceBalance = 0;
    }

    return res.json({
      success: true,
      stockist: {
        id: stockist.id,
        firm_name: stockist.firm_name,
        contact_person: stockist.contact_person,
        mobile_number: stockist.mobile_number,
        gst_number: stockist.gst_number
      },
      advance_balance: advanceBalance,
      count: unpaidInvoices.length,
      data: unpaidInvoices
    });
  } catch (error) {
    console.error('Error fetching unpaid invoices for stockist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unpaid invoices',
      error: error.message
    });
  }
};

// 2. Get stockist advance balance and transaction history
exports.getStockistAdvanceDetails = async (req, res) => {
  try {
    const { models } = getModels(req);
    const { StockistAdvanceTransaction, Stockist, Voucher, InvoiceTracking } = models;
    const { stockistId } = req.params;

    if (!stockistId) {
      return res.status(400).json({ success: false, message: 'Stockist ID is required' });
    }

    const stockist = await Stockist.findByPk(stockistId);
    if (!stockist) {
      return res.status(404).json({ success: false, message: 'Stockist not found' });
    }

    const currentBalance = await calculateStockistAdvanceBalance(
      StockistAdvanceTransaction,
      stockistId
    );

    const history = await StockistAdvanceTransaction.findAll({
      where: { stockist_id: stockistId },
      include: [
        {
          model: Voucher,
          as: 'voucher',
          attributes: ['id', 'voucher_number', 'voucher_date', 'payment_mode', 'amount']
        },
        {
          model: InvoiceTracking,
          as: 'invoice',
          attributes: ['id', 'invoice_number', 'invoice_date', 'amount']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.json({
      success: true,
      stockist_id: stockistId,
      firm_name: stockist.firm_name,
      advance_balance: currentBalance,
      history
    });
  } catch (error) {
    console.error('Error fetching stockist advance details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch advance details',
      error: error.message
    });
  }
};

// 3. Create Payment Voucher (Atomic Transaction with Validation)
exports.createVoucher = async (req, res) => {
  const { models, sequelize } = getModels(req);
  const {
    Voucher,
    VoucherPaymentAllocation,
    StockistAdvanceTransaction,
    InvoiceTracking,
    Stockist,
    Bank
  } = models;

  const dbTransaction = await sequelize.transaction();

  try {
    const {
      voucher_date,
      stockist_id,
      payment_mode = 'Cash',
      bank_id,
      reference_number,
      amount = 0,
      use_advance_amount = 0,
      invoice_allocations = [],
      remarks
    } = req.body;

    // Validation 1: Stockist
    if (!stockist_id) {
      await dbTransaction.rollback();
      return res.status(400).json({ success: false, message: 'Stockist is required' });
    }

    const stockist = await Stockist.findByPk(stockist_id, { transaction: dbTransaction });
    if (!stockist) {
      await dbTransaction.rollback();
      return res.status(404).json({ success: false, message: 'Stockist not found' });
    }

    // Validation 2: Monetary amounts
    const numAmount = parseFloat(amount || 0);
    const numUseAdvance = parseFloat(use_advance_amount || 0);

    if (isNaN(numAmount) || numAmount < 0) {
      await dbTransaction.rollback();
      return res.status(400).json({ success: false, message: 'Amount received must be 0 or greater' });
    }
    if (isNaN(numUseAdvance) || numUseAdvance < 0) {
      await dbTransaction.rollback();
      return res.status(400).json({ success: false, message: 'Used advance amount must be 0 or greater' });
    }

    const totalFundsAvailable = parseFloat((numAmount + numUseAdvance).toFixed(2));
    if (totalFundsAvailable <= 0) {
      await dbTransaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Total payment received or advance used must be greater than zero'
      });
    }

    // Validation 3: Check advance balance availability if using advance
    let currentAdvanceBalance = 0;
    if (numUseAdvance > 0) {
      currentAdvanceBalance = await calculateStockistAdvanceBalance(
        StockistAdvanceTransaction,
        stockist_id,
        dbTransaction
      );
      if (numUseAdvance > currentAdvanceBalance + 0.001) {
        await dbTransaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot use ₹${numUseAdvance.toLocaleString('en-IN')} advance. Available advance balance is ₹${currentAdvanceBalance.toLocaleString('en-IN')}`
        });
      }
    }

    // Validation 4: Bank verification if Bank payment mode
    const isBankMode = ['Bank', 'Cheque', 'UPI', 'NEFT/RTGS', 'Online', 'Card'].includes(payment_mode);
    let bankRecord = null;
    if (isBankMode && numAmount > 0) {
      if (!bank_id) {
        await dbTransaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Bank account selection is required when payment mode is ' + payment_mode
        });
      }
      bankRecord = await Bank.findByPk(bank_id, { transaction: dbTransaction });
      if (!bankRecord) {
        await dbTransaction.rollback();
        return res.status(404).json({ success: false, message: 'Selected bank account not found' });
      }
    }

    // Validation 5: Process and validate invoice allocations
    let totalAllocated = 0;
    const validatedAllocations = [];

    if (Array.isArray(invoice_allocations) && invoice_allocations.length > 0) {
      for (const item of invoice_allocations) {
        const allocAmount = parseFloat(item.allocated_amount || 0);
        if (allocAmount <= 0) continue;

        const invoice = await InvoiceTracking.findByPk(item.invoice_id, {
          transaction: dbTransaction,
          lock: dbTransaction.LOCK.UPDATE
        });

        if (!invoice) {
          await dbTransaction.rollback();
          return res.status(404).json({
            success: false,
            message: `Invoice ID ${item.invoice_id} not found`
          });
        }

        if (invoice.stockist_id !== stockist_id) {
          await dbTransaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Invoice ${invoice.invoice_number} does not belong to the selected Stockist`
          });
        }

        if (invoice.status === 'cancelled') {
          await dbTransaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Invoice ${invoice.invoice_number} is cancelled and cannot accept payments`
          });
        }

        // Re-check exact latest paid amount inside lock
        const existingAllocationsSum = await VoucherPaymentAllocation.sum('allocated_amount', {
          where: { invoice_id: invoice.id },
          transaction: dbTransaction
        }) || 0;

        const invTotal = parseFloat(invoice.amount || 0);
        const remainingBalance = parseFloat((invTotal - existingAllocationsSum).toFixed(2));

        if (allocAmount > remainingBalance + 0.009) {
          await dbTransaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Allocation amount ₹${allocAmount.toFixed(2)} exceeds latest outstanding balance of ₹${remainingBalance.toFixed(2)} for Invoice ${invoice.invoice_number}`
          });
        }

        totalAllocated = parseFloat((totalAllocated + allocAmount).toFixed(2));
        validatedAllocations.push({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          allocated_amount: allocAmount,
          notes: item.notes || null
        });
      }
    }

    if (totalAllocated > totalFundsAvailable + 0.009) {
      await dbTransaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Total allocated amount (₹${totalAllocated.toFixed(2)}) exceeds total available funds (₹${totalFundsAvailable.toFixed(2)})`
      });
    }

    // Excess amount becomes Stockist Advance Credit
    const advanceAmountGenerated = parseFloat(Math.max(0, totalFundsAvailable - totalAllocated).toFixed(2));

    // Auto-generate sequential unique Voucher Number: VCH-YYYYMMDD-XXXX
    const today = new Date();
    const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const prefix = `VCH-${datePrefix}`;

    const countToday = await Voucher.count({
      where: {
        voucher_number: {
          [Op.like]: `${prefix}-%`
        }
      },
      transaction: dbTransaction
    });

    const nextSeq = String(countToday + 1).padStart(4, '0');
    const voucherNumber = `${prefix}-${nextSeq}`;

    // 1. Create Voucher Record
    const voucher = await Voucher.create({
      voucher_number: voucherNumber,
      voucher_date: voucher_date || today.toISOString().split('T')[0],
      voucher_type: totalAllocated > 0 ? 'receipt' : 'advance_payment',
      stockist_id,
      party_name: stockist.firm_name,
      payment_mode,
      bank_id: isBankMode && numAmount > 0 ? bank_id : null,
      reference_number: reference_number ? reference_number.trim() : null,
      amount: numAmount,
      allocated_amount: totalAllocated,
      advance_amount: advanceAmountGenerated,
      used_advance_amount: numUseAdvance,
      status: 'posted',
      remarks: remarks ? remarks.trim() : null,
      created_by: req.user?.id || null,
      updated_by: req.user?.id || null
    }, { transaction: dbTransaction });

    // 2. Create Voucher Payment Allocations
    for (const alloc of validatedAllocations) {
      await VoucherPaymentAllocation.create({
        voucher_id: voucher.id,
        invoice_id: alloc.invoice_id,
        allocated_amount: alloc.allocated_amount,
        notes: alloc.notes
      }, { transaction: dbTransaction });
    }

    // 3. Handle Advance Debit (If existing advance was consumed)
    if (numUseAdvance > 0) {
      const remainingAdvanceAfterDebit = parseFloat((currentAdvanceBalance - numUseAdvance).toFixed(2));
      await StockistAdvanceTransaction.create({
        stockist_id,
        voucher_id: voucher.id,
        transaction_date: voucher.voucher_date,
        type: 'debit',
        amount: numUseAdvance,
        balance_after: remainingAdvanceAfterDebit,
        description: `Advance adjusted against Voucher ${voucherNumber} towards invoice allocations`,
        created_by: req.user?.id || null
      }, { transaction: dbTransaction });
    }

    // 4. Handle Advance Credit (If excess payment generated advance)
    if (advanceAmountGenerated > 0) {
      // Re-calculate updated running advance balance
      const baseAdvance = numUseAdvance > 0
        ? parseFloat((currentAdvanceBalance - numUseAdvance).toFixed(2))
        : await calculateStockistAdvanceBalance(StockistAdvanceTransaction, stockist_id, dbTransaction);

      const newAdvanceBalance = parseFloat((baseAdvance + advanceAmountGenerated).toFixed(2));

      await StockistAdvanceTransaction.create({
        stockist_id,
        voucher_id: voucher.id,
        transaction_date: voucher.voucher_date,
        type: 'credit',
        amount: advanceAmountGenerated,
        balance_after: newAdvanceBalance,
        description: `Advance/Credit balance generated from excess payment on Voucher ${voucherNumber}`,
        created_by: req.user?.id || null
      }, { transaction: dbTransaction });
    }

    // 5. Update Bank Balance if paid through Bank
    if (bankRecord && numAmount > 0) {
      await bankRecord.increment('current_balance', {
        by: numAmount,
        transaction: dbTransaction
      });
    }

    // Commit all database operations atomically
    await dbTransaction.commit();

    // Fetch complete created voucher for return
    const createdVoucherWithDetails = await Voucher.findByPk(voucher.id, {
      include: [
        {
          model: Stockist,
          as: 'stockist',
          attributes: ['id', 'firm_name', 'contact_person', 'mobile_number', 'gst_number']
        },
        {
          model: Bank,
          as: 'bank',
          attributes: ['id', 'bank_name', 'account_name', 'account_number', 'current_balance']
        },
        {
          model: VoucherPaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: InvoiceTracking,
              as: 'invoice',
              attributes: ['id', 'invoice_number', 'invoice_date', 'amount']
            }
          ]
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: `Voucher ${voucherNumber} created successfully`,
      data: createdVoucherWithDetails
    });
  } catch (error) {
    await dbTransaction.rollback();
    console.error('Error creating payment voucher:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment voucher',
      error: error.message
    });
  }
};

// 4. Get all Vouchers (with filtering, search, pagination & summary statistics)
exports.getVouchers = async (req, res) => {
  try {
    const { models } = getModels(req);
    const { Voucher, Stockist, Bank, User, VoucherPaymentAllocation, InvoiceTracking } = models;
    const {
      page = 1,
      limit = 10,
      stockist_id,
      payment_mode,
      bank_id,
      startDate,
      endDate,
      search
    } = req.query;

    const where = {};

    if (stockist_id) where.stockist_id = stockist_id;
    if (payment_mode && payment_mode !== 'all') where.payment_mode = payment_mode;
    if (bank_id && bank_id !== 'all') where.bank_id = bank_id;

    if (startDate && endDate) {
      where.voucher_date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.voucher_date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.voucher_date = { [Op.lte]: endDate };
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      const searchOp = Op.iLike || Op.like;
      where[Op.or] = [
        { voucher_number: { [searchOp]: q } },
        { party_name: { [searchOp]: q } },
        { reference_number: { [searchOp]: q } },
        { remarks: { [searchOp]: q } }
      ];
    }

    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.max(1, parseInt(limit) || 10);
    const offset = (parsedPage - 1) * parsedLimit;

    const { count, rows } = await Voucher.findAndCountAll({
      where,
      include: [
        {
          model: Stockist,
          as: 'stockist',
          attributes: ['id', 'firm_name', 'contact_person', 'mobile_number', 'gst_number']
        },
        {
          model: Bank,
          as: 'bank',
          attributes: ['id', 'bank_name', 'account_name', 'account_number']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: VoucherPaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: InvoiceTracking,
              as: 'invoice',
              attributes: ['id', 'invoice_number', 'invoice_date', 'amount']
            }
          ]
        }
      ],
      order: [['voucher_date', 'DESC'], ['created_at', 'DESC']],
      limit: parsedLimit,
      offset,
      distinct: true
    });

    // Summary statistics for vouchers matching filter
    const totalAmount = await Voucher.sum('amount', { where }) || 0;
    const totalAllocated = await Voucher.sum('allocated_amount', { where }) || 0;
    const totalAdvance = await Voucher.sum('advance_amount', { where }) || 0;

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(count / parsedLimit)
      },
      summary: {
        total_amount: parseFloat(totalAmount.toFixed(2)),
        total_allocated: parseFloat(totalAllocated.toFixed(2)),
        total_advance: parseFloat(totalAdvance.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch vouchers',
      error: error.message
    });
  }
};

// 5. Get Voucher by ID (Full detail view)
exports.getVoucherById = async (req, res) => {
  try {
    const { models } = getModels(req);
    const {
      Voucher,
      Stockist,
      Bank,
      User,
      VoucherPaymentAllocation,
      InvoiceTracking,
      StockistAdvanceTransaction
    } = models;

    const voucher = await Voucher.findByPk(req.params.id, {
      include: [
        {
          model: Stockist,
          as: 'stockist',
          attributes: ['id', 'firm_name', 'contact_person', 'mobile_number', 'email_address', 'registered_office_address', 'gst_number', 'pan_number']
        },
        {
          model: Bank,
          as: 'bank',
          attributes: ['id', 'bank_name', 'account_name', 'account_number', 'ifsc_code', 'branch_name', 'current_balance']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: VoucherPaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: InvoiceTracking,
              as: 'invoice',
              attributes: ['id', 'invoice_number', 'invoice_date', 'amount', 'taxable_amount', 'discount_amount', 'status']
            }
          ]
        },
        {
          model: StockistAdvanceTransaction,
          as: 'advanceTransactions',
          attributes: ['id', 'type', 'amount', 'balance_after', 'description', 'created_at']
        }
      ]
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }

    return res.json({
      success: true,
      data: voucher
    });
  } catch (error) {
    console.error('Error fetching voucher by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve voucher details',
      error: error.message
    });
  }
};
