// src/courierCompany/courierCompanyController.js
const { QueryTypes } = require('sequelize');

// GET /api/courier-companies
exports.getCompanies = async (req, res) => {
  try {
    const CourierCompany = req.app.get('models').CourierCompany;
    await CourierCompany.sync();

    const { active_only } = req.query;
    const where = {};
    if (active_only === 'true') {
      where.is_active = true;
    }

    const companies = await CourierCompany.findAll({
      where,
      order: [['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching courier companies:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch courier companies',
      error: error.message
    });
  }
};

// GET /api/courier-companies/unmapped-names
// Gets distinct raw courier company names currently in invoice_tracking & forwarding_notes
exports.getUnmappedNames = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');
    
    const invoiceResults = await sequelize.query(
      `SELECT courier_company_name AS name, COUNT(*)::int AS count 
       FROM invoice_tracking 
       WHERE courier_company_name IS NOT NULL AND TRIM(courier_company_name) != '' 
       GROUP BY courier_company_name`,
      { type: QueryTypes.SELECT }
    );

    const forwardingResults = await sequelize.query(
      `SELECT transport_courier_name AS name, COUNT(*)::int AS count 
       FROM forwarding_notes 
       WHERE transport_courier_name IS NOT NULL AND TRIM(transport_courier_name) != '' 
       GROUP BY transport_courier_name`,
      { type: QueryTypes.SELECT }
    );

    // Merge counts by raw name
    const nameMap = {};
    
    (invoiceResults || []).forEach(item => {
      const name = item.name ? item.name.trim() : '';
      if (name) {
        if (!nameMap[name]) nameMap[name] = { name, invoiceCount: 0, forwardingCount: 0, totalCount: 0 };
        nameMap[name].invoiceCount += parseInt(item.count, 10) || 0;
        nameMap[name].totalCount += parseInt(item.count, 10) || 0;
      }
    });

    (forwardingResults || []).forEach(item => {
      const name = item.name ? item.name.trim() : '';
      if (name) {
        if (!nameMap[name]) nameMap[name] = { name, invoiceCount: 0, forwardingCount: 0, totalCount: 0 };
        nameMap[name].forwardingCount += parseInt(item.count, 10) || 0;
        nameMap[name].totalCount += parseInt(item.count, 10) || 0;
      }
    });

    const unmappedList = Object.values(nameMap).sort((a, b) => b.totalCount - a.totalCount);

    return res.status(200).json({
      success: true,
      count: unmappedList.length,
      data: unmappedList
    });
  } catch (error) {
    console.error('Error fetching unmapped courier names:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch raw database courier names',
      error: error.message
    });
  }
};

// POST /api/courier-companies/bulk-replace
// Replaces old raw courier company names with a standardized master courier company name in DB
exports.bulkReplaceNames = async (req, res) => {
  try {
    const sequelize = req.app.get('sequelize');
    const { oldNames, targetName } = req.body;

    if (!oldNames || !Array.isArray(oldNames) || oldNames.length === 0 || !targetName) {
      return res.status(400).json({
        success: false,
        message: 'oldNames array and targetName are required'
      });
    }

    const cleanTargetName = targetName.trim();
    const cleanOldNames = oldNames.map(n => n.trim()).filter(Boolean);

    if (cleanOldNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid oldNames provided'
      });
    }

    // Update invoice_tracking
    const [invResults, invMetadata] = await sequelize.query(
      `UPDATE invoice_tracking 
       SET courier_company_name = :targetName, updated_at = NOW() 
       WHERE TRIM(courier_company_name) IN (:oldNames)`,
      {
        replacements: { targetName: cleanTargetName, oldNames: cleanOldNames }
      }
    );

    // Update forwarding_notes
    const [fwdResults, fwdMetadata] = await sequelize.query(
      `UPDATE forwarding_notes 
       SET transport_courier_name = :targetName, updated_at = NOW() 
       WHERE TRIM(transport_courier_name) IN (:oldNames)`,
      {
        replacements: { targetName: cleanTargetName, oldNames: cleanOldNames }
      }
    );

    return res.status(200).json({
      success: true,
      message: `Successfully replaced ${cleanOldNames.join(', ')} with "${cleanTargetName}" in database records.`,
      targetName: cleanTargetName,
      oldNames: cleanOldNames
    });
  } catch (error) {
    console.error('Error bulk replacing courier names:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk replace courier names',
      error: error.message
    });
  }
};

// GET /api/courier-companies/:id
exports.getCompanyById = async (req, res) => {
  try {
    const CourierCompany = req.app.get('models').CourierCompany;
    const company = await CourierCompany.findByPk(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Courier company not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error fetching courier company:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch courier company',
      error: error.message
    });
  }
};

// POST /api/courier-companies
exports.createCompany = async (req, res) => {
  try {
    const CourierCompany = req.app.get('models').CourierCompany;
    const { name, code, transporter_id, contact_person, phone, email, address, website_url, notes, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Courier company name is required'
      });
    }

    const existing = await CourierCompany.findOne({
      where: { name: name.trim() }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A courier company with this name already exists'
      });
    }

    const company = await CourierCompany.create({
      name: name.trim(),
      code: code ? code.trim() : null,
      transporter_id: transporter_id ? transporter_id.trim() : null,
      contact_person: contact_person ? contact_person.trim() : null,
      phone: phone ? phone.trim() : null,
      email: email ? email.trim() : null,
      address: address ? address.trim() : null,
      website_url: website_url ? website_url.trim() : null,
      notes: notes ? notes.trim() : null,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user ? req.user.id : null
    });

    return res.status(201).json({
      success: true,
      message: 'Courier company created successfully',
      data: company
    });
  } catch (error) {
    console.error('Error creating courier company:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create courier company',
      error: error.message
    });
  }
};

// PUT /api/courier-companies/:id
exports.updateCompany = async (req, res) => {
  try {
    const CourierCompany = req.app.get('models').CourierCompany;
    const company = await CourierCompany.findByPk(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Courier company not found'
      });
    }

    const { name, code, transporter_id, contact_person, phone, email, address, website_url, notes, is_active } = req.body;

    if (name && name.trim() !== company.name) {
      const existing = await CourierCompany.findOne({
        where: { name: name.trim() }
      });
      if (existing && existing.id !== company.id) {
        return res.status(400).json({
          success: false,
          message: 'Another courier company with this name already exists'
        });
      }
      company.name = name.trim();
    }

    if (code !== undefined) company.code = code ? code.trim() : null;
    if (transporter_id !== undefined) company.transporter_id = transporter_id ? transporter_id.trim() : null;
    if (contact_person !== undefined) company.contact_person = contact_person ? contact_person.trim() : null;
    if (phone !== undefined) company.phone = phone ? phone.trim() : null;
    if (email !== undefined) company.email = email ? email.trim() : null;
    if (address !== undefined) company.address = address ? address.trim() : null;
    if (website_url !== undefined) company.website_url = website_url ? website_url.trim() : null;
    if (notes !== undefined) company.notes = notes ? notes.trim() : null;
    if (is_active !== undefined) company.is_active = is_active;
    if (req.user) company.updated_by = req.user.id;

    await company.save();

    return res.status(200).json({
      success: true,
      message: 'Courier company updated successfully',
      data: company
    });
  } catch (error) {
    console.error('Error updating courier company:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update courier company',
      error: error.message
    });
  }
};

// DELETE /api/courier-companies/:id
exports.deleteCompany = async (req, res) => {
  try {
    const CourierCompany = req.app.get('models').CourierCompany;
    const company = await CourierCompany.findByPk(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Courier company not found'
      });
    }

    await company.destroy();

    return res.status(200).json({
      success: true,
      message: 'Courier company deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting courier company:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete courier company',
      error: error.message
    });
  }
};
