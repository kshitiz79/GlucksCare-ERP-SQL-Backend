// src/bankMaster/bankController.js
const { Op } = require('sequelize');

const getBankModel = async (req) => {
  let Bank = req.app?.get('models')?.Bank;
  if (!Bank && req.tenantDb?.models?.Bank) {
    Bank = req.tenantDb.models.Bank;
  }
  if (!Bank) {
    const sequelize = req.tenantDb || req.app?.get('sequelize');
    Bank = require('./Bank')(sequelize);
  }
  if (Bank && typeof Bank.sync === 'function') {
    await Bank.sync();
  }
  return Bank;
};

// 1. Get all banks with search & filtering
exports.getBanks = async (req, res) => {
  try {
    const Bank = await getBankModel(req);
    const { search, is_active, is_primary, account_type } = req.query;

    const where = {};

    if (is_active !== undefined && is_active !== 'all') {
      where.is_active = is_active === 'true' || is_active === true;
    }

    if (is_primary !== undefined && is_primary !== 'all') {
      where.is_primary = is_primary === 'true' || is_primary === true;
    }

    if (account_type && account_type !== 'All' && account_type !== 'all') {
      where.account_type = account_type;
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { bank_name: { [Op.iLike]: q } },
        { account_name: { [Op.iLike]: q } },
        { account_number: { [Op.iLike]: q } },
        { ifsc_code: { [Op.iLike]: q } },
        { branch_name: { [Op.iLike]: q } },
        { city: { [Op.iLike]: q } },
        { upi_id: { [Op.iLike]: q } }
      ];
    }

    const banks = await Bank.findAll({
      where,
      order: [
        ['is_primary', 'DESC'],
        ['is_active', 'DESC'],
        ['bank_name', 'ASC'],
        ['created_at', 'DESC']
      ]
    });

    return res.json({
      success: true,
      count: banks.length,
      data: banks
    });
  } catch (error) {
    console.error('Error fetching banks:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bank accounts',
      error: error.message
    });
  }
};

// 2. Get single bank by ID
exports.getBankById = async (req, res) => {
  try {
    const Bank = await getBankModel(req);
    const bank = await Bank.findByPk(req.params.id);

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    return res.json({
      success: true,
      data: bank
    });
  } catch (error) {
    console.error('Error fetching bank by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bank details',
      error: error.message
    });
  }
};

// 3. Create new bank account
exports.createBank = async (req, res) => {
  try {
    const Bank = await getBankModel(req);
    const {
      bank_name,
      account_name,
      account_number,
      account_type,
      ifsc_code,
      branch_name,
      branch_code,
      micr_code,
      swift_code,
      upi_id,
      upi_number,
      opening_balance,
      current_balance,
      address,
      city,
      state,
      pincode,
      contact_number,
      contact_person,
      email,
      net_banking_url,
      is_primary,
      is_active,
      notes
    } = req.body;

    if (!bank_name || !bank_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Bank Name is required'
      });
    }

    // If marked as primary, unset other primary accounts
    if (is_primary === true || is_primary === 'true') {
      await Bank.update(
        { is_primary: false },
        { where: { is_primary: true } }
      );
    } else {
      // If this is the very first bank created, automatically make it primary
      const count = await Bank.count();
      if (count === 0) {
        req.body.is_primary = true;
      }
    }

    const createdBank = await Bank.create({
      bank_name: bank_name.trim(),
      account_name: account_name ? account_name.trim() : null,
      account_number: account_number ? account_number.trim() : null,
      account_type: account_type || 'Current',
      ifsc_code: ifsc_code ? ifsc_code.trim().toUpperCase() : null,
      branch_name: branch_name ? branch_name.trim() : null,
      branch_code: branch_code ? branch_code.trim() : null,
      micr_code: micr_code ? micr_code.trim() : null,
      swift_code: swift_code ? swift_code.trim().toUpperCase() : null,
      upi_id: upi_id ? upi_id.trim() : null,
      upi_number: upi_number ? upi_number.trim() : null,
      opening_balance: opening_balance !== undefined && opening_balance !== '' ? parseFloat(opening_balance) : 0,
      current_balance: current_balance !== undefined && current_balance !== '' ? parseFloat(current_balance) : (opening_balance ? parseFloat(opening_balance) : 0),
      address: address ? address.trim() : null,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      pincode: pincode ? pincode.trim() : null,
      contact_number: contact_number ? contact_number.trim() : null,
      contact_person: contact_person ? contact_person.trim() : null,
      email: email ? email.trim() : null,
      net_banking_url: net_banking_url ? net_banking_url.trim() : null,
      is_primary: req.body.is_primary === true || req.body.is_primary === 'true',
      is_active: is_active !== undefined ? (is_active === true || is_active === 'true') : true,
      notes: notes ? notes.trim() : null,
      created_by: req.user?.id || null,
      updated_by: req.user?.id || null
    });

    return res.status(201).json({
      success: true,
      message: 'Bank account added successfully',
      data: createdBank
    });
  } catch (error) {
    console.error('Error creating bank account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create bank account',
      error: error.message
    });
  }
};

// 4. Update bank account
exports.updateBank = async (req, res) => {
  try {
    const Bank = await getBankModel(req);
    const bank = await Bank.findByPk(req.params.id);

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const {
      bank_name,
      account_name,
      account_number,
      account_type,
      ifsc_code,
      branch_name,
      branch_code,
      micr_code,
      swift_code,
      upi_id,
      upi_number,
      opening_balance,
      current_balance,
      address,
      city,
      state,
      pincode,
      contact_number,
      contact_person,
      email,
      net_banking_url,
      is_primary,
      is_active,
      notes
    } = req.body;

    if (is_primary === true || is_primary === 'true') {
      await Bank.update(
        { is_primary: false },
        { where: { id: { [Op.ne]: bank.id } } }
      );
    }

    await bank.update({
      bank_name: bank_name !== undefined ? bank_name.trim() : bank.bank_name,
      account_name: account_name !== undefined ? (account_name ? account_name.trim() : null) : bank.account_name,
      account_number: account_number !== undefined ? (account_number ? account_number.trim() : null) : bank.account_number,
      account_type: account_type !== undefined ? account_type : bank.account_type,
      ifsc_code: ifsc_code !== undefined ? (ifsc_code ? ifsc_code.trim().toUpperCase() : null) : bank.ifsc_code,
      branch_name: branch_name !== undefined ? (branch_name ? branch_name.trim() : null) : bank.branch_name,
      branch_code: branch_code !== undefined ? (branch_code ? branch_code.trim() : null) : bank.branch_code,
      micr_code: micr_code !== undefined ? (micr_code ? micr_code.trim() : null) : bank.micr_code,
      swift_code: swift_code !== undefined ? (swift_code ? swift_code.trim().toUpperCase() : null) : bank.swift_code,
      upi_id: upi_id !== undefined ? (upi_id ? upi_id.trim() : null) : bank.upi_id,
      upi_number: upi_number !== undefined ? (upi_number ? upi_number.trim() : null) : bank.upi_number,
      opening_balance: opening_balance !== undefined && opening_balance !== '' ? parseFloat(opening_balance) : bank.opening_balance,
      current_balance: current_balance !== undefined && current_balance !== '' ? parseFloat(current_balance) : bank.current_balance,
      address: address !== undefined ? (address ? address.trim() : null) : bank.address,
      city: city !== undefined ? (city ? city.trim() : null) : bank.city,
      state: state !== undefined ? (state ? state.trim() : null) : bank.state,
      pincode: pincode !== undefined ? (pincode ? pincode.trim() : null) : bank.pincode,
      contact_number: contact_number !== undefined ? (contact_number ? contact_number.trim() : null) : bank.contact_number,
      contact_person: contact_person !== undefined ? (contact_person ? contact_person.trim() : null) : bank.contact_person,
      email: email !== undefined ? (email ? email.trim() : null) : bank.email,
      net_banking_url: net_banking_url !== undefined ? (net_banking_url ? net_banking_url.trim() : null) : bank.net_banking_url,
      is_primary: is_primary !== undefined ? (is_primary === true || is_primary === 'true') : bank.is_primary,
      is_active: is_active !== undefined ? (is_active === true || is_active === 'true') : bank.is_active,
      notes: notes !== undefined ? (notes ? notes.trim() : null) : bank.notes,
      updated_by: req.user?.id || null
    });

    return res.json({
      success: true,
      message: 'Bank account updated successfully',
      data: bank
    });
  } catch (error) {
    console.error('Error updating bank account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bank account',
      error: error.message
    });
  }
};

// 5. Delete bank account
exports.deleteBank = async (req, res) => {
  try {
    const Bank = await getBankModel(req);
    const bank = await Bank.findByPk(req.params.id);

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const isPrimary = bank.is_primary;
    await bank.destroy();

    // If deleted bank was primary, set another active bank as primary if any exist
    if (isPrimary) {
      const nextBank = await Bank.findOne({ where: { is_active: true } });
      if (nextBank) {
        await nextBank.update({ is_primary: true });
      }
    }

    return res.json({
      success: true,
      message: 'Bank account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete bank account',
      error: error.message
    });
  }
};

// 6. Set primary bank
exports.setPrimaryBank = async (req, res) => {
  try {
    const Bank = await getBankModel(req);
    const bank = await Bank.findByPk(req.params.id);

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    await Bank.update(
      { is_primary: false },
      { where: { id: { [Op.ne]: bank.id } } }
    );

    await bank.update({
      is_primary: true,
      is_active: true
    });

    return res.json({
      success: true,
      message: `${bank.bank_name} set as primary bank account`,
      data: bank
    });
  } catch (error) {
    console.error('Error setting primary bank:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set primary bank',
      error: error.message
    });
  }
};

// 7. Toggle active status
exports.toggleBankStatus = async (req, res) => {
  try {
    const Bank = await getBankModel(req);
    const bank = await Bank.findByPk(req.params.id);

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const nextStatus = !bank.is_active;

    // If deactivating a primary bank, unset primary
    const updateData = { is_active: nextStatus };
    if (!nextStatus && bank.is_primary) {
      updateData.is_primary = false;
    }

    await bank.update(updateData);

    return res.json({
      success: true,
      message: `Bank account ${nextStatus ? 'activated' : 'deactivated'} successfully`,
      data: bank
    });
  } catch (error) {
    console.error('Error toggling bank status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle bank status',
      error: error.message
    });
  }
};
