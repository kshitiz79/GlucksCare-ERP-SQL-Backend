const { Op } = require('sequelize');

const getModels = (req) => {
  return req.app.get('models') || req.db;
};

// 1. Fetch complete Bridge Data: MRs, Head Offices, Doctors, Chemists, Stockists, and Mappings
const getPartnerBridgeData = async (req, res) => {
  try {
    const { 
      User, 
      HeadOffice, 
      Doctor, 
      Chemist, 
      Stockist, 
      Area,
      PartnerMrAssignment 
    } = getModels(req);

    const { head_office_id } = req.query;

    // 1. Fetch all Head Offices
    const headOfficesRaw = await HeadOffice.findAll({
      attributes: ['id', 'name', 'code', 'stateId'],
      order: [['name', 'ASC']]
    });

    // 2. Fetch all Active MR Users (role === 'User' or designation Medical Representative)
    const mrsRaw = await User.findAll({
      where: {
        role: { [Op.in]: ['User', 'MR', 'Medical Representative'] },
        is_active: true
      },
      attributes: ['id', 'name', 'employee_code', 'email', 'mobile_number', 'role', 'head_office_id'],
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] },
          attributes: ['id', 'name']
        }
      ],
      order: [['name', 'ASC']]
    });

    // Build map of HeadOffice ID -> Array of MRs
    const hoMrMap = {};
    headOfficesRaw.forEach(ho => {
      hoMrMap[ho.id] = [];
    });

    const mrsList = mrsRaw.map(mr => {
      const u = mr.toJSON();
      const hoIds = new Set();
      if (u.head_office_id) hoIds.add(u.head_office_id);
      if (u.headOffices && Array.isArray(u.headOffices)) {
        u.headOffices.forEach(h => hoIds.add(h.id));
      }

      hoIds.forEach(hid => {
        if (!hoMrMap[hid]) hoMrMap[hid] = [];
        hoMrMap[hid].push({
          id: u.id,
          name: u.name,
          employee_code: u.employee_code,
          mobile_number: u.mobile_number
        });
      });

      return {
        id: u.id,
        name: u.name,
        employeeCode: u.employee_code,
        email: u.email,
        mobileNumber: u.mobile_number,
        primaryHeadOfficeId: u.head_office_id,
        assignedHeadOfficeIds: Array.from(hoIds),
        assignedHeadOffices: u.headOffices || []
      };
    });

    // Format Head Offices with MR count and shared territory flags
    const headOfficesList = headOfficesRaw.map(ho => {
      const assignedMrs = hoMrMap[ho.id] || [];
      return {
        id: ho.id,
        name: ho.name,
        code: ho.code,
        mrCount: assignedMrs.length,
        isSharedHeadOffice: assignedMrs.length >= 2,
        assignedMrs: assignedMrs
      };
    });

    // 3. Fetch Existing Custom Assignments
    let assignments = [];
    if (PartnerMrAssignment) {
      try {
        assignments = await PartnerMrAssignment.findAll({
          raw: true
        });
      } catch (err) {
        console.warn('⚠️ PartnerMrAssignment table fetch issue:', err.message);
      }
    }

    const assignmentMap = {}; // key: `${partnerType}_${partnerId}`
    assignments.forEach(a => {
      const key = `${a.partner_type || a.partnerType}_${a.partner_id || a.partnerId}`;
      assignmentMap[key] = {
        userId: a.user_id || a.userId,
        linkedStockistId: a.linked_stockist_id || a.linkedStockistId,
        notes: a.notes
      };
    });

    // 4. Filter criteria if specific head office requested
    const docWhere = head_office_id ? { headOfficeId: head_office_id } : {};
    const chemWhere = head_office_id ? { head_office_id: head_office_id } : {};
    const stockWhere = head_office_id ? { head_office_id: head_office_id } : {};

    // Fetch Partners
    const [doctorsRaw, chemistsRaw, stockistsRaw, areasRaw] = await Promise.all([
      Doctor.findAll({
        where: docWhere,
        attributes: ['id', 'name', 'specialization', 'clinic_name', 'phone', 'priority', 'headOfficeId', 'areaId', 'registration_number'],
        order: [['name', 'ASC']]
      }),
      Chemist.findAll({
        where: chemWhere,
        attributes: ['id', 'firm_name', 'contact_person_name', 'mobile_no', 'drug_license_number', 'head_office_id', 'area_id'],
        order: [['firm_name', 'ASC']]
      }),
      Stockist.findAll({
        where: stockWhere,
        attributes: ['id', 'firm_name', 'contact_person', 'mobile_number', 'drug_license_number', 'gst_number', 'head_office_id', 'area_id'],
        order: [['firm_name', 'ASC']]
      }),
      Area.findAll({
        attributes: ['id', 'name', 'head_office_id'],
        order: [['name', 'ASC']]
      })
    ]);

    const areaMap = {};
    areasRaw.forEach(a => {
      areaMap[a.id] = a.name;
    });

    const stockistNameMap = {};
    stockistsRaw.forEach(s => {
      stockistNameMap[s.id] = s.firm_name;
    });

    const mrLookup = {};
    mrsList.forEach(m => {
      mrLookup[m.id] = m;
    });

    // Helper to resolve MR assignment
    const resolveMrAssignment = (partnerType, partnerId, hoId) => {
      const custom = assignmentMap[`${partnerType}_${partnerId}`];
      if (custom && custom.userId) {
        const mr = mrLookup[custom.userId];
        return {
          assignedMrId: custom.userId,
          assignedMrName: mr ? mr.name : 'Unknown MR',
          assignedMrCode: mr ? mr.employeeCode : '',
          isExplicitlyAssigned: true,
          linkedStockistId: custom.linkedStockistId || null,
          linkedStockistName: custom.linkedStockistId ? (stockistNameMap[custom.linkedStockistId] || 'Linked Stockist') : null,
          notes: custom.notes || ''
        };
      }

      // Default resolution based on Head Office MR count
      const availableMrs = hoMrMap[hoId] || [];
      if (availableMrs.length === 1) {
        // Automatically default to the single MR
        const singleMr = availableMrs[0];
        return {
          assignedMrId: singleMr.id,
          assignedMrName: singleMr.name,
          assignedMrCode: singleMr.employee_code,
          isExplicitlyAssigned: false,
          isDefaultResolved: true,
          linkedStockistId: custom?.linkedStockistId || null,
          linkedStockistName: custom?.linkedStockistId ? (stockistNameMap[custom.linkedStockistId] || 'Linked Stockist') : null,
          notes: ''
        };
      }

      // Shared Head Office with 2+ MRs and not yet explicitly assigned
      return {
        assignedMrId: null,
        assignedMrName: null,
        assignedMrCode: null,
        isExplicitlyAssigned: false,
        isSharedHqUnassigned: availableMrs.length >= 2,
        linkedStockistId: custom?.linkedStockistId || null,
        linkedStockistName: custom?.linkedStockistId ? (stockistNameMap[custom.linkedStockistId] || 'Linked Stockist') : null,
        notes: ''
      };
    };

    // Format Doctors
    const doctors = doctorsRaw.map(d => {
      const hoId = d.headOfficeId;
      const resAssignment = resolveMrAssignment('doctor', d.id, hoId);
      const availableMrs = hoMrMap[hoId] || [];

      return {
        id: d.id,
        name: d.name,
        specialization: d.specialization || 'General',
        clinicName: d.clinic_name || '',
        phone: d.phone || '',
        priority: d.priority || 'C',
        regNo: d.registration_number || '',
        headOfficeId: hoId,
        areaId: d.areaId,
        areaName: areaMap[d.areaId] || 'General Area',
        availableMrsCount: availableMrs.length,
        isSharedHeadOffice: availableMrs.length >= 2,
        ...resAssignment
      };
    });

    // Format Chemists
    const chemists = chemistsRaw.map(c => {
      const hoId = c.head_office_id;
      const resAssignment = resolveMrAssignment('chemist', c.id, hoId);
      const availableMrs = hoMrMap[hoId] || [];

      return {
        id: c.id,
        name: c.firm_name,
        firmName: c.firm_name,
        contactPerson: c.contact_person_name || '',
        mobile: c.mobile_no || '',
        drugLicense: c.drug_license_number || '',
        headOfficeId: hoId,
        areaId: c.area_id,
        areaName: areaMap[c.area_id] || 'General Area',
        availableMrsCount: availableMrs.length,
        isSharedHeadOffice: availableMrs.length >= 2,
        ...resAssignment
      };
    });

    // Format Stockists
    const stockists = stockistsRaw.map(s => {
      const hoId = s.head_office_id;
      const resAssignment = resolveMrAssignment('stockist', s.id, hoId);
      const availableMrs = hoMrMap[hoId] || [];

      // Calculate how many doctors & chemists in this HQ are mapped/linked to this stockist
      const linkedDoctors = doctors.filter(doc => doc.linkedStockistId === s.id);
      const linkedChemists = chemists.filter(chem => chem.linkedStockistId === s.id);

      return {
        id: s.id,
        name: s.firm_name,
        firmName: s.firm_name,
        contactPerson: s.contact_person || '',
        mobile: s.mobile_number || '',
        drugLicense: s.drug_license_number || '',
        gstNo: s.gst_number || '',
        headOfficeId: hoId,
        areaId: s.area_id,
        areaName: areaMap[s.area_id] || 'General Area',
        availableMrsCount: availableMrs.length,
        isSharedHeadOffice: availableMrs.length >= 2,
        linkedDoctorsCount: linkedDoctors.length,
        linkedChemistsCount: linkedChemists.length,
        ...resAssignment
      };
    });

    // Aggregate summary statistics
    const totalDoctors = doctors.length;
    const totalChemists = chemists.length;
    const totalStockists = stockists.length;
    const unassignedDoctors = doctors.filter(d => !d.assignedMrId).length;
    const unassignedChemists = chemists.filter(c => !c.assignedMrId).length;
    const unassignedStockists = stockists.filter(s => !s.assignedMrId).length;
    const sharedHeadOfficesCount = headOfficesList.filter(h => h.isSharedHeadOffice).length;

    res.json({
      success: true,
      data: {
        mrs: mrsList,
        headOffices: headOfficesList,
        doctors,
        chemists,
        stockists,
        summary: {
          totalMrs: mrsList.length,
          totalHeadOffices: headOfficesList.length,
          sharedHeadOfficesCount,
          totalDoctors,
          totalChemists,
          totalStockists,
          unassignedDoctors,
          unassignedChemists,
          unassignedStockists,
          totalUnassigned: unassignedDoctors + unassignedChemists + unassignedStockists
        }
      }
    });

  } catch (error) {
    console.error('Error fetching partner bridge data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch partner bridge data'
    });
  }
};

// 2. Assign a Single Partner (Doctor / Chemist / Stockist) to an MR
const assignPartnerToMr = async (req, res) => {
  try {
    const { PartnerMrAssignment } = getModels(req);
    const { 
      partner_type, 
      partner_id, 
      user_id, 
      head_office_id, 
      linked_stockist_id, 
      notes 
    } = req.body;

    if (!partner_type || !partner_id) {
      return res.status(400).json({
        success: false,
        message: 'partner_type and partner_id are required'
      });
    }

    if (!['doctor', 'chemist', 'stockist'].includes(partner_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid partner_type. Must be doctor, chemist, or stockist'
      });
    }

    if (!PartnerMrAssignment) {
      return res.status(500).json({
        success: false,
        message: 'PartnerMrAssignment model not initialized'
      });
    }

    // Check if assignment already exists
    const existing = await PartnerMrAssignment.findOne({
      where: {
        partnerType: partner_type,
        partnerId: partner_id
      }
    });

    let result;
    if (existing) {
      existing.userId = user_id !== undefined ? (user_id || null) : existing.userId;
      if (head_office_id) existing.headOfficeId = head_office_id;
      if (linked_stockist_id !== undefined) existing.linkedStockistId = linked_stockist_id || null;
      if (notes !== undefined) existing.notes = notes;
      existing.assignedBy = req.user?.id || null;
      result = await existing.save();
    } else {
      result = await PartnerMrAssignment.create({
        partnerType: partner_type,
        partnerId: partner_id,
        userId: user_id || null,
        headOfficeId: head_office_id || null,
        linkedStockistId: linked_stockist_id || null,
        assignedBy: req.user?.id || null,
        notes: notes || null
      });
    }

    res.json({
      success: true,
      message: `Partner assigned successfully`,
      data: result
    });

  } catch (error) {
    console.error('Error assigning partner to MR:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign partner to MR'
    });
  }
};

// 3. Bulk Assign Partners (e.g., assign all unassigned in a shared HQ to an MR)
const bulkAssignPartners = async (req, res) => {
  try {
    const { PartnerMrAssignment } = getModels(req);
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'assignments array is required'
      });
    }

    let updatedCount = 0;
    for (const item of assignments) {
      const { partner_type, partner_id, user_id, head_office_id, linked_stockist_id } = item;
      if (!partner_type || !partner_id) continue;

      const existing = await PartnerMrAssignment.findOne({
        where: {
          partnerType: partner_type,
          partnerId: partner_id
        }
      });

      if (existing) {
        if (user_id !== undefined) existing.userId = user_id || null;
        if (head_office_id) existing.headOfficeId = head_office_id;
        if (linked_stockist_id !== undefined) existing.linkedStockistId = linked_stockist_id || null;
        existing.assignedBy = req.user?.id || null;
        await existing.save();
      } else {
        await PartnerMrAssignment.create({
          partnerType: partner_type,
          partnerId: partner_id,
          userId: user_id || null,
          headOfficeId: head_office_id || null,
          linkedStockistId: linked_stockist_id || null,
          assignedBy: req.user?.id || null
        });
      }
      updatedCount++;
    }

    res.json({
      success: true,
      message: `Successfully updated ${updatedCount} partner assignment(s)`,
      count: updatedCount
    });

  } catch (error) {
    console.error('Error bulk assigning partners:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute bulk assignment'
    });
  }
};

// 4. Link a Doctor or Chemist to a Stockist
const linkStockistToPartner = async (req, res) => {
  try {
    const { PartnerMrAssignment } = getModels(req);
    const { partner_type, partner_id, stockist_id } = req.body;

    if (!partner_type || !partner_id) {
      return res.status(400).json({
        success: false,
        message: 'partner_type and partner_id are required'
      });
    }

    const existing = await PartnerMrAssignment.findOne({
      where: {
        partnerType: partner_type,
        partnerId: partner_id
      }
    });

    if (existing) {
      existing.linkedStockistId = stockist_id || null;
      await existing.save();
    } else {
      await PartnerMrAssignment.create({
        partnerType: partner_type,
        partnerId: partner_id,
        linkedStockistId: stockist_id || null,
        assignedBy: req.user?.id || null
      });
    }

    res.json({
      success: true,
      message: 'Stockist linked successfully'
    });

  } catch (error) {
    console.error('Error linking stockist to partner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to link stockist'
    });
  }
};

const linkPartnerToStockist = linkStockistToPartner;

module.exports = {
  getPartnerBridgeData,
  assignPartnerToMr,
  bulkAssignPartners,
  linkStockistToPartner,
  linkPartnerToStockist
};

