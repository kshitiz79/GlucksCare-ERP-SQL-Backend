// src/ledger/ledgerController.js
const { Op } = require('sequelize');

const getModels = (req) => {
  let models = req.app?.get('models');
  if (!models && req.tenantDb?.models) {
    models = req.tenantDb.models;
  }
  const sequelize = req.tenantDb || req.app?.get('sequelize');

  if (!models) models = {};

  if (!models.PartyOpeningBalance && sequelize) {
    models.PartyOpeningBalance = require('../partyOpeningBalance/PartyOpeningBalance')(sequelize);
    models.Stockist = require('../stockist/Stockist')(sequelize);
    models.FinancialYear = require('../financialYear/FinancialYear')(sequelize);
    models.InvoiceTracking = require('../invoiceTracking/InvoiceTracking')(sequelize);
    models.Voucher = require('../voucher/Voucher')(sequelize);
    models.Bank = require('../bankMaster/Bank')(sequelize);
  }

  return { models, sequelize };
};

// 1. Get Party / Customer Account Ledger Statement with Running Balance
exports.getPartyLedger = async (req, res) => {
  try {
    const { models, sequelize } = getModels(req);
    const { PartyOpeningBalance, Stockist, FinancialYear, InvoiceTracking, Voucher, Bank } = models;
    const { stockistId } = req.params;
    const { financial_year_id, start_date, end_date } = req.query;

    if (!stockistId) {
      return res.status(400).json({ success: false, message: 'Stockist ID is required' });
    }

    const stockist = await Stockist.findByPk(stockistId);
    if (!stockist) {
      return res.status(404).json({ success: false, message: 'Stockist not found' });
    }

    // Resolve FY
    let fy = null;
    if (financial_year_id) {
      fy = await FinancialYear.findByPk(financial_year_id);
    }
    if (!fy) {
      fy = await FinancialYear.findOne({ where: { is_active: true } }) ||
           await FinancialYear.findOne({ order: [['start_date', 'DESC']] });
    }

    const queryStartDate = start_date || fy?.start_date || '2026-04-01';
    const queryEndDate = end_date || fy?.end_date || '2027-03-31';

    // 1. Get Party Opening Balance for this FY
    let openingBalanceRecord = null;
    if (fy && PartyOpeningBalance) {
      openingBalanceRecord = await PartyOpeningBalance.findOne({
        where: {
          stockist_id: stockistId,
          financial_year_id: fy.id
        }
      });
    }

    const openingAmt = parseFloat(openingBalanceRecord?.amount || 0);
    const openingDir = openingBalanceRecord?.direction || 'Dr';
    const openingSource = openingBalanceRecord?.source || 'MANUAL';

    // 2. Fetch Invoices for this party within date range
    const cleanFirmName = (stockist.firm_name || '').trim();
    const invoiceWhere = {
      [Op.and]: [
        {
          [Op.or]: [
            { stockist_id: stockistId },
            ...(cleanFirmName ? [{ party_name: cleanFirmName }] : [])
          ]
        },
        { invoice_date: { [Op.between]: [queryStartDate, queryEndDate] } },
        {
          [Op.or]: [
            { status: { [Op.ne]: 'cancelled' } },
            { status: null }
          ]
        }
      ]
    };

    const invoices = await InvoiceTracking.findAll({
      where: invoiceWhere,
      order: [['invoice_date', 'ASC'], ['created_at', 'ASC']]
    });

    // 3. Fetch Vouchers for this party within date range
    const voucherWhere = {
      [Op.and]: [
        {
          [Op.or]: [
            { stockist_id: stockistId },
            ...(cleanFirmName ? [{ party_name: cleanFirmName }] : [])
          ]
        },
        { voucher_date: { [Op.between]: [queryStartDate, queryEndDate] } },
        { status: { [Op.ne]: 'cancelled' } }
      ]
    };

    const vouchers = await Voucher.findAll({
      where: voucherWhere,
      include: [
        {
          model: Bank,
          as: 'bank',
          attributes: ['bank_name', 'account_number']
        }
      ],
      order: [['voucher_date', 'ASC'], ['created_at', 'ASC']]
    });

    // 4. Combine and Sort Chronologically
    const rawEvents = [];

    invoices.forEach((inv) => {
      const amt = parseFloat(inv.amount || 0);
      rawEvents.push({
        id: `inv-${inv.id}`,
        rawDate: inv.invoice_date,
        date: inv.invoice_date,
        voucher_no: inv.invoice_number,
        type: 'Sale Invoice',
        particulars: `Sale Bill No. ${inv.invoice_number}`,
        debit: amt,
        credit: 0.00,
        notes: inv.remarks || null,
        created_at: inv.created_at
      });
    });

    vouchers.forEach((vch) => {
      const amt = parseFloat(vch.amount || 0);
      let particulars = vch.payment_mode || 'Payment Received';
      if (vch.bank?.bank_name) {
        particulars = `${vch.bank.bank_name}${vch.reference_number ? ` - Ref: ${vch.reference_number}` : ''}`;
      } else if (vch.reference_number) {
        particulars = `${vch.payment_mode} - Ref: ${vch.reference_number}`;
      }

      rawEvents.push({
        id: `vch-${vch.id}`,
        rawDate: vch.voucher_date,
        date: vch.voucher_date,
        voucher_no: vch.voucher_number,
        type: 'Receipt Voucher',
        particulars,
        debit: 0.00,
        credit: amt,
        notes: vch.remarks || null,
        created_at: vch.created_at
      });
    });

    // Sort by date ASC, then created_at ASC
    rawEvents.sort((a, b) => {
      if (a.rawDate !== b.rawDate) {
        return new Date(a.rawDate) - new Date(b.rawDate);
      }
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // 5. Calculate Continuous Running Balance
    let currentSignedBalance = (openingDir === 'Cr') ? -openingAmt : openingAmt;
    let totalDebitSum = (openingDir === 'Dr') ? openingAmt : 0;
    let totalCreditSum = (openingDir === 'Cr') ? openingAmt : 0;

    const transactions = rawEvents.map((ev) => {
      currentSignedBalance = currentSignedBalance + ev.debit - ev.credit;
      totalDebitSum += ev.debit;
      totalCreditSum += ev.credit;

      const dir = currentSignedBalance >= 0 ? 'Dr' : 'Cr';
      const absRunning = Math.abs(parseFloat(currentSignedBalance.toFixed(2)));

      return {
        ...ev,
        running_balance: absRunning,
        direction: dir
      };
    });

    const closingSigned = currentSignedBalance;
    const closingAmt = Math.abs(parseFloat(closingSigned.toFixed(2)));
    const closingDir = closingSigned >= 0 ? 'Dr' : 'Cr';

    return res.json({
      success: true,
      party: {
        id: stockist.id,
        firm_name: stockist.firm_name,
        contact_person: stockist.contact_person,
        mobile_number: stockist.mobile_number,
        gst_number: stockist.gst_number || null,
        registered_office_address: stockist.registered_office_address || null,
        category: 'SUNDRY DEBTORS'
      },
      financial_year: fy ? { id: fy.id, name: fy.name, display: `F.Y. ${fy.name}` } : null,
      period: {
        from: queryStartDate,
        to: queryEndDate
      },
      opening_balance: {
        amount: openingAmt,
        direction: openingDir,
        source: openingSource
      },
      transactions,
      summary: {
        opening_balance: openingAmt,
        opening_direction: openingDir,
        total_debit: parseFloat(totalDebitSum.toFixed(2)),
        total_credit: parseFloat(totalCreditSum.toFixed(2)),
        closing_balance: closingAmt,
        closing_direction: closingDir,
        transaction_count: transactions.length
      }
    });
  } catch (error) {
    console.error('Error generating party ledger:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
