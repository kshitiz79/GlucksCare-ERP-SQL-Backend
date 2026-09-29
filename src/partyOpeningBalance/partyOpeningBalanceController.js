// src/partyOpeningBalance/partyOpeningBalanceController.js
const { Op } = require('sequelize');

const getModels = (req) => {
  let models = req.app?.get('models');
  if (!models && req.tenantDb?.models) {
    models = req.tenantDb.models;
  }
  const sequelize = req.tenantDb || req.app?.get('sequelize');

  if (!models) models = {};

  if (!models.PartyOpeningBalance && sequelize) {
    models.PartyOpeningBalance = require('./PartyOpeningBalance')(sequelize);
    models.Stockist = require('../stockist/Stockist')(sequelize);
    models.FinancialYear = require('../financialYear/FinancialYear')(sequelize);
    models.InvoiceTracking = require('../invoiceTracking/InvoiceTracking')(sequelize);
    models.Voucher = require('../voucher/Voucher')(sequelize);
  }

  return { models, sequelize };
};

const ensurePartyOpeningBalanceTable = async (sequelize) => {
  if (!sequelize) return;
  try {
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    } catch (e) {}

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS party_opening_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stockist_id UUID NOT NULL,
        financial_year_id UUID NOT NULL,
        amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        direction VARCHAR(10) NOT NULL DEFAULT 'Dr',
        source VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
        source_financial_year_id UUID,
        notes TEXT,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_party_fy_opening UNIQUE (stockist_id, financial_year_id)
      );
      CREATE INDEX IF NOT EXISTS idx_pob_stockist ON party_opening_balances (stockist_id);
      CREATE INDEX IF NOT EXISTS idx_pob_fy ON party_opening_balances (financial_year_id);
    `);
  } catch (err) {
    console.warn('ensurePartyOpeningBalanceTable warning:', err.message);
  }
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveFinancialYear = async (FinancialYear, fyInput) => {
  if (!FinancialYear || !fyInput) return null;
  if (UUID_REGEX.test(fyInput)) {
    const found = await FinancialYear.findByPk(fyInput);
    if (found) return found;
  }
  
  let nameMatch = String(fyInput).match(/(\d{4}-\d{2,4})/);
  let searchName = nameMatch ? nameMatch[1] : String(fyInput);
  if (searchName && searchName.length === 9) {
    searchName = searchName.slice(0, 4) + '-' + searchName.slice(7);
  }
  
  let fy = await FinancialYear.findOne({ where: { name: searchName } });
  if (!fy) {
    fy = await FinancialYear.findOne({ where: { is_active: true } });
  }
  if (!fy) {
    fy = await FinancialYear.findOne({ order: [['start_date', 'DESC']] });
  }
  if (!fy) {
    fy = await FinancialYear.create({
      name: '2026-27',
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      is_active: true
    });
  }
  return fy;
};

// 1. Get Opening Balances for a specific FY
exports.getOpeningBalances = async (req, res) => {
  try {
    const { models, sequelize } = getModels(req);
    await ensurePartyOpeningBalanceTable(sequelize);
    const { PartyOpeningBalance, Stockist, FinancialYear } = models;

    const { financial_year_id } = req.query;

    if (!financial_year_id) {
      return res.status(400).json({ success: false, message: 'financial_year_id is required' });
    }

    const fy = await resolveFinancialYear(FinancialYear, financial_year_id);
    if (!fy) {
      return res.status(404).json({ success: false, message: 'Financial year not found' });
    }

    const records = await PartyOpeningBalance.findAll({
      where: { financial_year_id: fy.id },
      order: [['created_at', 'ASC']]
    });

    return res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('Error fetching opening balances:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get single party opening balance by stockist and FY
exports.getPartyOpeningBalance = async (req, res) => {
  try {
    const { models, sequelize } = getModels(req);
    await ensurePartyOpeningBalanceTable(sequelize);
    const { PartyOpeningBalance, FinancialYear } = models;
    const { stockistId } = req.params;
    const { financial_year_id } = req.query;

    if (!stockistId || !financial_year_id) {
      return res.status(400).json({
        success: false,
        message: 'Stockist ID and financial_year_id are required'
      });
    }

    const fy = await resolveFinancialYear(FinancialYear, financial_year_id);
    if (!fy) {
      return res.status(404).json({ success: false, message: 'Financial year not found' });
    }

    const record = await PartyOpeningBalance.findOne({
      where: {
        stockist_id: stockistId,
        financial_year_id: fy.id
      }
    });

    return res.json({
      success: true,
      data: record || null
    });
  } catch (error) {
    console.error('Error fetching party opening balance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Upsert Opening Balance (Single or Bulk)
exports.upsertOpeningBalance = async (req, res) => {
  try {
    const { models, sequelize } = getModels(req);
    await ensurePartyOpeningBalanceTable(sequelize);
    const { PartyOpeningBalance, Stockist, FinancialYear } = models;

    const { financial_year_id, stockist_id, amount, direction, source, notes, items } = req.body;

    if (!financial_year_id) {
      return res.status(400).json({ success: false, message: 'financial_year_id is required' });
    }

    const fy = await resolveFinancialYear(FinancialYear, financial_year_id);
    if (!fy) {
      return res.status(404).json({ success: false, message: 'Financial year not found' });
    }

    // Bulk Mode
    if (Array.isArray(items) && items.length > 0) {
      const results = [];
      for (const item of items) {
        if (!item.stockist_id) continue;
        const numAmt = Math.max(0, parseFloat(item.amount || 0));
        const dir = (item.direction === 'Cr') ? 'Cr' : 'Dr';
        const src = item.source || 'MANUAL';

        const [rec, created] = await PartyOpeningBalance.findOrCreate({
          where: {
            stockist_id: item.stockist_id,
            financial_year_id: fy.id
          },
          defaults: {
            amount: numAmt,
            direction: dir,
            source: src,
            notes: item.notes || null,
            created_by: req.user?.id || null,
            updated_by: req.user?.id || null
          }
        });

        if (!created) {
          await rec.update({
            amount: numAmt,
            direction: dir,
            source: src,
            notes: item.notes !== undefined ? item.notes : rec.notes,
            updated_by: req.user?.id || null
          });
        }
        results.push(rec);
      }

      return res.json({
        success: true,
        message: `Updated opening balances for ${results.length} parties`,
        data: results
      });
    }

    // Single Mode
    if (!stockist_id) {
      return res.status(400).json({ success: false, message: 'stockist_id is required' });
    }

    const numAmt = Math.max(0, parseFloat(amount || 0));
    const dir = (direction === 'Cr') ? 'Cr' : 'Dr';
    const src = source || 'MANUAL';

    const [record, created] = await PartyOpeningBalance.findOrCreate({
      where: {
        stockist_id,
        financial_year_id: fy.id
      },
      defaults: {
        amount: numAmt,
        direction: dir,
        source: src,
        notes: notes || null,
        created_by: req.user?.id || null,
        updated_by: req.user?.id || null
      }
    });

    if (!created) {
      await record.update({
        amount: numAmt,
        direction: dir,
        source: src,
        notes: notes !== undefined ? notes : record.notes,
        updated_by: req.user?.id || null
      });
    }

    return res.json({
      success: true,
      message: 'Opening balance saved successfully',
      data: record
    });
  } catch (error) {
    console.error('Error saving opening balance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Check Discrepancies between Previous FY Closing and Target FY Opening
exports.checkDiscrepancies = async (req, res) => {
  try {
    const { models, sequelize } = getModels(req);
    await ensurePartyOpeningBalanceTable(sequelize);
    const { PartyOpeningBalance, Stockist, FinancialYear, InvoiceTracking, Voucher } = models;

    const { previous_financial_year_id, current_financial_year_id } = req.query;

    if (!previous_financial_year_id || !current_financial_year_id) {
      return res.status(400).json({
        success: false,
        message: 'previous_financial_year_id and current_financial_year_id are required'
      });
    }

    const [prevFY, currFY, stockists] = await Promise.all([
      resolveFinancialYear(FinancialYear, previous_financial_year_id),
      resolveFinancialYear(FinancialYear, current_financial_year_id),
      Stockist.findAll({ order: [['firm_name', 'ASC']] })
    ]);

    if (!prevFY || !currFY) {
      return res.status(404).json({ success: false, message: 'Financial Year not found' });
    }

    // Get all opening balances for previous FY and current FY
    const [prevOpenings, currOpenings] = await Promise.all([
      PartyOpeningBalance.findAll({ where: { financial_year_id: prevFY.id } }),
      PartyOpeningBalance.findAll({ where: { financial_year_id: currFY.id } })
    ]);

    const prevOpeningMap = {};
    prevOpenings.forEach(p => {
      prevOpeningMap[p.stockist_id] = {
        amount: parseFloat(p.amount || 0),
        direction: p.direction || 'Dr'
      };
    });

    const currOpeningMap = {};
    currOpenings.forEach(c => {
      currOpeningMap[c.stockist_id] = {
        id: c.id,
        amount: parseFloat(c.amount || 0),
        direction: c.direction || 'Dr',
        source: c.source
      };
    });

    // Compute Previous FY Invoices and Vouchers per Stockist
    const [invoices, vouchers] = await Promise.all([
      InvoiceTracking.findAll({
        where: {
          invoice_date: { [Op.between]: [prevFY.start_date, prevFY.end_date] },
          status: { [Op.ne]: 'cancelled' }
        },
        attributes: ['stockist_id', 'amount']
      }),
      Voucher.findAll({
        where: {
          voucher_date: { [Op.between]: [prevFY.start_date, prevFY.end_date] },
          status: { [Op.ne]: 'cancelled' }
        },
        attributes: ['stockist_id', 'amount']
      })
    ]);

    const invoiceSumMap = {};
    invoices.forEach(inv => {
      if (inv.stockist_id) {
        invoiceSumMap[inv.stockist_id] = (invoiceSumMap[inv.stockist_id] || 0) + parseFloat(inv.amount || 0);
      }
    });

    const voucherSumMap = {};
    vouchers.forEach(vch => {
      if (vch.stockist_id) {
        voucherSumMap[vch.stockist_id] = (voucherSumMap[vch.stockist_id] || 0) + parseFloat(vch.amount || 0);
      }
    });

    const discrepancyList = [];

    for (const stk of stockists) {
      const prevOp = prevOpeningMap[stk.id] || { amount: 0, direction: 'Dr' };
      const baseOpSign = prevOp.direction === 'Cr' ? -prevOp.amount : prevOp.amount;

      const totalSales = invoiceSumMap[stk.id] || 0;
      const totalPayments = voucherSumMap[stk.id] || 0;

      // Previous Closing = Opening + Sales (Dr) - Payments (Cr)
      const prevClosingSigned = baseOpSign + totalSales - totalPayments;
      const prevClosingAmt = Math.abs(parseFloat(prevClosingSigned.toFixed(2)));
      const prevClosingDir = prevClosingSigned >= 0 ? 'Dr' : 'Cr';

      const currOp = currOpeningMap[stk.id] || { amount: 0, direction: 'Dr', source: 'MANUAL' };
      const currOpeningSigned = currOp.direction === 'Cr' ? -currOp.amount : currOp.amount;

      const differenceSigned = parseFloat((prevClosingSigned - currOpeningSigned).toFixed(2));
      const hasDiscrepancy = Math.abs(differenceSigned) > 0.009;

      discrepancyList.push({
        stockist_id: stk.id,
        firm_name: stk.firm_name,
        contact_person: stk.contact_person,
        gst_number: stk.gst_number,
        previous_fy_closing: prevClosingAmt,
        previous_fy_direction: prevClosingDir,
        current_fy_opening: currOp.amount,
        current_fy_direction: currOp.direction,
        difference: Math.abs(differenceSigned),
        has_discrepancy: hasDiscrepancy,
        source: currOp.source || 'MANUAL'
      });
    }

    return res.json({
      success: true,
      count: discrepancyList.length,
      data: discrepancyList
    });
  } catch (error) {
    console.error('Error checking discrepancies:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Carry Forward Balances from Previous FY to Target FY
exports.carryForwardBalances = async (req, res) => {
  try {
    const { models, sequelize } = getModels(req);
    await ensurePartyOpeningBalanceTable(sequelize);
    const { PartyOpeningBalance, FinancialYear, Stockist, InvoiceTracking, Voucher } = models;

    const { from_financial_year_id, to_financial_year_id, stockist_ids } = req.body;

    if (!from_financial_year_id || !to_financial_year_id) {
      return res.status(400).json({
        success: false,
        message: 'from_financial_year_id and to_financial_year_id are required'
      });
    }

    const [prevFY, targetFY] = await Promise.all([
      resolveFinancialYear(FinancialYear, from_financial_year_id),
      resolveFinancialYear(FinancialYear, to_financial_year_id)
    ]);

    if (!prevFY || !targetFY) {
      return res.status(404).json({ success: false, message: 'Financial Year not found' });
    }

    let targetStockistsWhere = {};
    if (Array.isArray(stockist_ids) && stockist_ids.length > 0) {
      targetStockistsWhere.id = { [Op.in]: stockist_ids };
    }

    const stockists = await Stockist.findAll({ where: targetStockistsWhere });

    const prevOpenings = await PartyOpeningBalance.findAll({
      where: { financial_year_id: prevFY.id }
    });
    const prevOpeningMap = {};
    prevOpenings.forEach(p => {
      prevOpeningMap[p.stockist_id] = {
        amount: parseFloat(p.amount || 0),
        direction: p.direction || 'Dr'
      };
    });

    const [invoices, vouchers] = await Promise.all([
      InvoiceTracking.findAll({
        where: {
          invoice_date: { [Op.between]: [prevFY.start_date, prevFY.end_date] },
          status: { [Op.ne]: 'cancelled' }
        },
        attributes: ['stockist_id', 'amount']
      }),
      Voucher.findAll({
        where: {
          voucher_date: { [Op.between]: [prevFY.start_date, prevFY.end_date] },
          status: { [Op.ne]: 'cancelled' }
        },
        attributes: ['stockist_id', 'amount']
      })
    ]);

    const invoiceSumMap = {};
    invoices.forEach(inv => {
      if (inv.stockist_id) {
        invoiceSumMap[inv.stockist_id] = (invoiceSumMap[inv.stockist_id] || 0) + parseFloat(inv.amount || 0);
      }
    });

    const voucherSumMap = {};
    vouchers.forEach(vch => {
      if (vch.stockist_id) {
        voucherSumMap[vch.stockist_id] = (voucherSumMap[vch.stockist_id] || 0) + parseFloat(vch.amount || 0);
      }
    });

    const results = [];

    for (const stk of stockists) {
      const prevOp = prevOpeningMap[stk.id] || { amount: 0, direction: 'Dr' };
      const baseOpSign = prevOp.direction === 'Cr' ? -prevOp.amount : prevOp.amount;

      const totalSales = invoiceSumMap[stk.id] || 0;
      const totalPayments = voucherSumMap[stk.id] || 0;

      const prevClosingSigned = baseOpSign + totalSales - totalPayments;
      const closingAmt = Math.abs(parseFloat(prevClosingSigned.toFixed(2)));
      const closingDir = prevClosingSigned >= 0 ? 'Dr' : 'Cr';

      const [rec, created] = await PartyOpeningBalance.findOrCreate({
        where: {
          stockist_id: stk.id,
          financial_year_id: to_financial_year_id
        },
        defaults: {
          amount: closingAmt,
          direction: closingDir,
          source: 'PREVIOUS_FY_CARRY_FORWARD',
          source_financial_year_id: from_financial_year_id,
          notes: `Carried forward from FY ${prevFY.name} Closing Balance`,
          created_by: req.user?.id || null,
          updated_by: req.user?.id || null
        }
      });

      if (!created) {
        await rec.update({
          amount: closingAmt,
          direction: closingDir,
          source: 'PREVIOUS_FY_CARRY_FORWARD',
          source_financial_year_id: from_financial_year_id,
          notes: `Updated from FY ${prevFY.name} Closing Balance`,
          updated_by: req.user?.id || null
        });
      }

      results.push(rec);
    }

    return res.json({
      success: true,
      message: `Carried forward balances for ${results.length} parties`,
      data: results
    });
  } catch (error) {
    console.error('Error executing carry forward:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
