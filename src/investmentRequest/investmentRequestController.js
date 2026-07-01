const { Op } = require('sequelize');
const cloudinary = require('../config/cloudinary');

// Helper function to upload image to Cloudinary
const uploadToCloudinary = async (imageData, isBase64 = true) => {
  try {
    let uploadData;

    if (isBase64) {
      uploadData = imageData;
    } else {
      uploadData = `data:${imageData.mimetype};base64,${imageData.buffer.toString('base64')}`;
    }

    const result = await cloudinary.uploader.upload(uploadData, {
      folder: 'investments',
      resource_type: 'auto'
    });

    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

// Helper function to calculate current MTD support value for a doctor
const getDoctorCurrentMtdSupport = async (models, doctorId) => {
  const { Sale } = models;
  if (!Sale) return 0;
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  const startStr = startOfMonth.toISOString().split('T')[0];
  const endStr = endOfMonth.toISOString().split('T')[0];

  const sales = await Sale.findAll({
    where: {
      doctor_id: doctorId,
      date: { [Op.between]: [startStr, endStr] }
    },
    attributes: ['amount'],
    raw: true
  });

  let totalValue = 0;
  sales.forEach(sale => {
    totalValue += Number(sale.amount || 0);
  });

  return totalValue;
};

// Transform request record for response
const formatInvestmentRequest = (reqRecord) => {
  const reqObj = reqRecord.toJSON ? reqRecord.toJSON() : reqRecord;
  return {
    ...reqObj,
    _id: reqObj.id,
    doctorName: reqObj.doctor ? reqObj.doctor.name : 'Unknown Doctor',
    userName: reqObj.user ? reqObj.user.name : 'Unknown User'
  };
};

// Helper function to check if a new request exceeds the doctor's UCPMP annual support cap
const checkUcpmpAnnualCap = async (models, doctorId, paymentMode, amount, items, ucpmpAnnualCap, excludeRequestId = null) => {
  const { InvestmentRequest } = models;
  
  let requestedAmount = 0;
  if (paymentMode === 'Items/Gift') {
    const itemsList = Array.isArray(items) ? items : [];
    requestedAmount = itemsList.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.value || 0)), 0);
  } else {
    requestedAmount = Number(amount || 0);
  }

  // Calculate current financial year spent
  const now = new Date();
  let startYear = now.getFullYear();
  if (now.getMonth() < 3) { // Jan, Feb, Mar are 0, 1, 2
    startYear -= 1;
  }
  const startOfFY = new Date(startYear, 3, 1, 0, 0, 0, 0); // April 1st
  const endOfFY = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); // March 31st next year

  const whereClause = {
    doctor_id: doctorId,
    status: 'Approved',
    created_at: { [Op.between]: [startOfFY, endOfFY] }
  };

  if (excludeRequestId) {
    whereClause.id = { [Op.ne]: excludeRequestId };
  }

  const approvedRequests = await InvestmentRequest.findAll({
    where: whereClause,
    attributes: ['payment_mode', 'amount', 'items'],
    raw: true
  });

  let spentFY = 0;
  approvedRequests.forEach(inv => {
    if (inv.payment_mode === 'Items/Gift') {
      const itemsList = Array.isArray(inv.items) ? inv.items : [];
      spentFY += itemsList.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.value || 0)), 0);
    } else {
      spentFY += Number(inv.amount || 0);
    }
  });

  const annualCap = Number(ucpmpAnnualCap !== undefined && ucpmpAnnualCap !== null ? ucpmpAnnualCap : 10000.00);
  const exceeds = (spentFY + requestedAmount) > annualCap;

  return {
    exceeds,
    spentFY,
    requestedAmount,
    annualCap,
    remaining: Math.max(0, annualCap - spentFY)
  };
};

// CREATE / SAVE Investment Request
const createInvestmentRequest = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { InvestmentRequest, Doctor } = models;
    
    let {
      doctorId,
      paymentMode,
      status,
      amount,
      purpose,
      bankDetails,
      paymentProof, // base64 representation if JSON
      upiId,
      items,
      justification
    } = req.body;

    // Default status to 'Pending' if not specified or invalid, but allow 'Draft'
    // If the user is Admin/Super Admin/State Head, they can pass status as 'Approved' directly!
    const canApproveDirectly = ['Super Admin', 'Admin', 'State Head'].includes(req.user.role);
    if (status === 'Approved' && canApproveDirectly) {
      // Allow status to remain 'Approved'
    } else if (status !== 'Draft') {
      status = 'Pending';
    }

    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required' });
    }

    if (!paymentMode) {
      return res.status(400).json({ success: false, message: 'Payment mode is required' });
    }

    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Parse items if it is stringified JSON (common in multipart form-data)
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid format for items list' });
      }
    }

    // Validate based on payment mode (only strictly enforce for non-Draft submissions)
    if (status !== 'Draft') {
      if (paymentMode === 'Cash') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid amount is required for Cash payment' });
        }
        if (!purpose) {
          return res.status(400).json({ success: false, message: 'Purpose is required for Cash payment' });
        }
      } else if (paymentMode === 'NEFT') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid amount is required for NEFT payment' });
        }
        if (!bankDetails) {
          return res.status(400).json({ success: false, message: 'Bank details are required for NEFT payment' });
        }
        if (!purpose) {
          return res.status(400).json({ success: false, message: 'Purpose is required for NEFT payment' });
        }
      } else if (paymentMode === 'UPI') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid amount is required for UPI payment' });
        }
        if (!purpose) {
          return res.status(400).json({ success: false, message: 'Purpose is required for UPI payment' });
        }
        if (!upiId && !paymentProof && !req.file) {
          return res.status(400).json({ success: false, message: 'UPI ID or QR Code/Payment Proof is required for UPI payment' });
        }
      } else if (paymentMode === 'Items/Gift') {
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ success: false, message: 'Items list is required for Items/Gift mode' });
        }
        for (const item of items) {
          if (!item.itemName || !item.quantity || isNaN(item.quantity) || !item.value || isNaN(item.value)) {
            return res.status(400).json({ success: false, message: 'Each item must have a name, quantity, and value' });
          }
        }
        if (!justification) {
          return res.status(400).json({ success: false, message: 'Clinical or educational justification is mandatory' });
        }
      } else {
        return res.status(400).json({ success: false, message: 'Invalid payment mode' });
      }
    }

    // Handle file upload to Cloudinary if a file is uploaded
    let proofUrl = null;
    if (req.file) {
      proofUrl = await uploadToCloudinary(req.file, false);
    } else if (paymentProof && typeof paymentProof === 'string' && paymentProof.startsWith('data:image')) {
      proofUrl = await uploadToCloudinary(paymentProof, true);
    }

    // UCPMP Annual Cap check (only if not Draft)
    if (status !== 'Draft') {
      const capCheck = await checkUcpmpAnnualCap(
        models,
        doctorId,
        paymentMode,
        amount,
        items,
        doctor.ucpmp_annual_cap
      );
      if (capCheck.exceeds) {
        return res.status(400).json({
          success: false,
          message: `This request exceeds the doctor's remaining UCPMP annual support cap of ₹${capCheck.remaining.toFixed(2)} (Annual Cap: ₹${capCheck.annualCap.toFixed(2)}, Current FY Spent: ₹${capCheck.spentFY.toFixed(2)}, Requested: ₹${capCheck.requestedAmount.toFixed(2)})`
        });
      }
    }

    // Fetch the doctor's dynamic MTD value to save as a snapshot
    const doctorMtd = await getDoctorCurrentMtdSupport(models, doctorId);

    const investmentRequest = await InvestmentRequest.create({
      user_id: req.user.id,
      doctor_id: doctorId,
      support_value_mtd: doctorMtd,
      payment_mode: paymentMode,
      amount: (paymentMode === 'Items/Gift' ? null : amount),
      purpose: (paymentMode === 'Items/Gift' ? null : purpose),
      bank_details: (paymentMode === 'NEFT' ? bankDetails : null),
      payment_proof: proofUrl || paymentProof || null,
      upi_id: (paymentMode === 'UPI' ? upiId : null),
      items: (paymentMode === 'Items/Gift' ? items : []),
      justification: (paymentMode === 'Items/Gift' ? justification : null),
      status: status
    });

    const fullRecord = await InvestmentRequest.findByPk(investmentRequest.id, {
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
        { model: models.User, as: 'user', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(201).json({
      success: true,
      message: status === 'Draft' ? 'Investment request saved as draft' : 'Investment request submitted successfully',
      data: formatInvestmentRequest(fullRecord)
    });
  } catch (error) {
    console.error('Create investment request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// EDIT / SUBMIT Draft Request
const updateInvestmentRequest = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { InvestmentRequest, Doctor } = models;
    const { id } = req.params;

    const request = await InvestmentRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Investment request not found' });
    }

    // Only allow editing own draft unless Admin
    if (request.user_id !== req.user.id && !['Super Admin', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only edit your own requests' });
    }

    // Only allow edit if status is Draft
    if (request.status !== 'Draft') {
      return res.status(400).json({ success: false, message: 'Only draft requests can be edited' });
    }

    let {
      doctorId,
      paymentMode,
      status,
      amount,
      purpose,
      bankDetails,
      paymentProof,
      upiId,
      items,
      justification
    } = req.body;

    // Use current fields as defaults if not provided in update body
    doctorId = doctorId || request.doctor_id;
    paymentMode = paymentMode || request.payment_mode;
    status = status || request.status;

    // Validate doctor existence if changing
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Parse items if stringified JSON
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid format for items list' });
      }
    }

    // Validate fields if submitting (status changed to Pending)
    if (status === 'Pending') {
      if (paymentMode === 'Cash') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid amount is required for Cash payment' });
        }
        if (!purpose) {
          return res.status(400).json({ success: false, message: 'Purpose is required for Cash payment' });
        }
      } else if (paymentMode === 'NEFT') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid amount is required for NEFT payment' });
        }
        if (!bankDetails) {
          return res.status(400).json({ success: false, message: 'Bank details are required for NEFT payment' });
        }
        if (!purpose) {
          return res.status(400).json({ success: false, message: 'Purpose is required for NEFT payment' });
        }
      } else if (paymentMode === 'UPI') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid amount is required for UPI payment' });
        }
        if (!purpose) {
          return res.status(400).json({ success: false, message: 'Purpose is required for UPI payment' });
        }
        if (!upiId && !paymentProof && !req.file && !request.payment_proof) {
          return res.status(400).json({ success: false, message: 'UPI ID or QR Code/Payment Proof is required for UPI payment' });
        }
      } else if (paymentMode === 'Items/Gift') {
        const checkItems = items || request.items;
        if (!checkItems || !Array.isArray(checkItems) || checkItems.length === 0) {
          return res.status(400).json({ success: false, message: 'Items list is required for Items/Gift mode' });
        }
        for (const item of checkItems) {
          if (!item.itemName || !item.quantity || isNaN(item.quantity) || !item.value || isNaN(item.value)) {
            return res.status(400).json({ success: false, message: 'Each item must have a name, quantity, and value' });
          }
        }
        if (!justification && !request.justification) {
          return res.status(400).json({ success: false, message: 'Clinical or educational justification is mandatory' });
        }
      }
    }

    // Handle file upload
    let proofUrl = request.payment_proof;
    if (req.file) {
      proofUrl = await uploadToCloudinary(req.file, false);
    } else if (paymentProof && typeof paymentProof === 'string' && paymentProof.startsWith('data:image')) {
      proofUrl = await uploadToCloudinary(paymentProof, true);
    } else if (paymentProof) {
      proofUrl = paymentProof;
    }

    // UCPMP Annual Cap check (only if not Draft)
    if (status !== 'Draft') {
      const capCheck = await checkUcpmpAnnualCap(
        models,
        doctorId,
        paymentMode,
        amount !== undefined ? amount : request.amount,
        items !== undefined ? items : request.items,
        doctor.ucpmp_annual_cap,
        request.id
      );
      if (capCheck.exceeds) {
        return res.status(400).json({
          success: false,
          message: `This request exceeds the doctor's remaining UCPMP annual support cap of ₹${capCheck.remaining.toFixed(2)} (Annual Cap: ₹${capCheck.annualCap.toFixed(2)}, Current FY Spent: ₹${capCheck.spentFY.toFixed(2)}, Requested: ₹${capCheck.requestedAmount.toFixed(2)})`
        });
      }
    }

    // Recalculate dynamic MTD support value if doctor changes or if submitting
    const doctorMtd = await getDoctorCurrentMtdSupport(models, doctorId);

    await request.update({
      doctor_id: doctorId,
      support_value_mtd: doctorMtd,
      payment_mode: paymentMode,
      amount: (paymentMode === 'Items/Gift' ? null : (amount !== undefined ? amount : request.amount)),
      purpose: (paymentMode === 'Items/Gift' ? null : (purpose !== undefined ? purpose : request.purpose)),
      bank_details: (paymentMode === 'NEFT' ? (bankDetails !== undefined ? bankDetails : request.bank_details) : null),
      payment_proof: proofUrl,
      upi_id: (paymentMode === 'UPI' ? (upiId !== undefined ? upiId : request.upi_id) : null),
      items: (paymentMode === 'Items/Gift' ? (items !== undefined ? items : request.items) : []),
      justification: (paymentMode === 'Items/Gift' ? (justification !== undefined ? justification : request.justification) : null),
      status: status
    });

    const fullRecord = await InvestmentRequest.findByPk(request.id, {
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
        { model: models.User, as: 'user', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.json({
      success: true,
      message: 'Investment request updated successfully',
      data: formatInvestmentRequest(fullRecord)
    });
  } catch (error) {
    console.error('Update investment request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET all/filtered Investment Requests
const getInvestmentRequests = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { InvestmentRequest, Doctor, User } = models;
    const { status } = req.query;

    const whereClause = {};

    // Apply status filter if provided
    if (status) {
      whereClause.status = status;
    }

    // Role-based scoping:
    // Super Admin / Admin can see all requests
    // State Head can see requests of creators within their state
    // Ordinary users can only see their own requests
    if (!['Super Admin', 'Admin'].includes(req.user.role)) {
      if (req.user.role === 'State Head') {
        if (!req.user.state_id) {
          return res.status(400).json({ success: false, message: 'State Head user does not have an assigned state' });
        }
        whereClause['$user.state_id$'] = req.user.state_id;
      } else {
        whereClause.user_id = req.user.id;
      }
    }

    const requests = await InvestmentRequest.findAll({
      where: whereClause,
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'state_id'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const formatted = requests.map(formatInvestmentRequest);

    res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('Fetch investment requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET Investment Requests by Head Office associations (for Managers / Team Leaders)
const getInvestmentRequestsByHeadOffice = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { InvestmentRequest, Doctor, User, HeadOffice } = models;
    const { status } = req.query;

    const whereClause = {};

    // Apply status filter if provided
    if (status) {
      whereClause.status = status;
    }

    // Role-based scoping:
    // Super Admin / Admin / Opps Team / National Head / Accounts / Logistics can see all requests
    const seeAllRoles = ['Super Admin', 'Admin', 'Opps Team', 'National Head', 'Accounts', 'Logistics'];
    const headOfficeFilteredRoles = ['State Head', 'Zonal Manager', 'Area Manager', 'Manager'];

    let userIncludeWhere = {};

    if (!seeAllRoles.includes(req.user.role)) {
      if (headOfficeFilteredRoles.includes(req.user.role)) {
        // Find all head office IDs associated with the caller using Sequelize associations
        const caller = await User.findByPk(req.user.id, {
          include: [{ model: HeadOffice, as: 'headOffices', attributes: ['id'] }]
        });

        const headOfficeIds = caller.headOffices ? caller.headOffices.map(h => h.id) : [];
        if (caller.head_office_id) {
          headOfficeIds.push(caller.head_office_id);
        }

        const uniqueHeadOfficeIds = Array.from(new Set(headOfficeIds));

        if (uniqueHeadOfficeIds.length > 0) {
          // Use sequelize includes to filter: user's direct head_office_id OR their headOffices association matches
          userIncludeWhere = {
            [Op.or]: [
              { head_office_id: uniqueHeadOfficeIds },
              { '$headOffices.id$': uniqueHeadOfficeIds }
            ]
          };
        } else {
          // If no head offices associated, only see own requests
          userIncludeWhere = { id: req.user.id };
        }
      } else {
        // Other roles (e.g. User) can only see their own requests
        userIncludeWhere = { id: req.user.id };
      }
    }

    const requests = await InvestmentRequest.findAll({
      where: whereClause,
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'name', 'email', 'state_id', 'head_office_id'],
          where: userIncludeWhere,
          required: true, // Force INNER JOIN to filter by user eligibility
          include: [
            {
              model: HeadOffice,
              as: 'headOffices',
              attributes: ['id'],
              required: false // Keep it as LEFT OUTER JOIN so we don't skip users without many-to-many associations
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const formatted = requests.map(formatInvestmentRequest);

    res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('Fetch investment requests by head office error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// APPROVE Request
const approveInvestmentRequest = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { InvestmentRequest, Doctor } = models;
    const { id } = req.params;

    // Check roles
    const allowedRoles = ['Super Admin', 'Admin', 'State Head', 'Zonal Manager', 'Area Manager', 'Manager'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to approve requests' });
    }

    const request = await InvestmentRequest.findByPk(id, {
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name', 'ucpmp_annual_cap'] },
        { 
          model: models.User, 
          as: 'user', 
          attributes: ['id', 'name', 'email', 'state_id', 'head_office_id'],
          include: [
            {
              model: models.HeadOffice,
              as: 'headOffices',
              attributes: ['id']
            }
          ]
        }
      ]
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Investment request not found' });
    }

    // For State Head, restrict approval to requests within their assigned state
    if (req.user.role === 'State Head') {
      if (!req.user.state_id) {
        return res.status(400).json({ success: false, message: 'State Head user does not have an assigned state' });
      }
      if (request.user && request.user.state_id !== req.user.state_id) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only approve requests from your state' });
      }
    }

    // For Zonal Manager, Area Manager, and Manager, restrict to their head offices
    if (['Zonal Manager', 'Area Manager', 'Manager'].includes(req.user.role)) {
      // Find all head office IDs associated with the caller
      const userHeadOffices = await models.UserHeadOffice.findAll({
        where: { user_id: req.user.id },
        attributes: ['head_office_id']
      });
      const headOfficeIds = userHeadOffices.map(u => u.head_office_id);
      if (req.user.head_office_id) {
        headOfficeIds.push(req.user.head_office_id);
      }
      const uniqueHeadOfficeIds = Array.from(new Set(headOfficeIds));

      // Get head office IDs of the request's creator
      const creatorHeadOfficeIds = [];
      if (request.user) {
        if (request.user.head_office_id) {
          creatorHeadOfficeIds.push(request.user.head_office_id);
        }
        if (request.user.headOffices) {
          request.user.headOffices.forEach(h => creatorHeadOfficeIds.push(h.id));
        }
      }
      const uniqueCreatorHeadOfficeIds = Array.from(new Set(creatorHeadOfficeIds));

      const hasCommonHeadOffice = uniqueHeadOfficeIds.some(id => uniqueCreatorHeadOfficeIds.includes(id));
      if (!hasCommonHeadOffice) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only approve requests from users in your associated head offices' });
      }
    }

    // UCPMP Annual Cap check
    const capCheck = await checkUcpmpAnnualCap(
      models,
      request.doctor_id,
      request.payment_mode,
      request.amount,
      request.items,
      request.doctor ? request.doctor.ucpmp_annual_cap : 10000.00,
      request.id
    );
    if (capCheck.exceeds) {
      return res.status(400).json({
        success: false,
        message: `This request exceeds the doctor's remaining UCPMP annual support cap of ₹${capCheck.remaining.toFixed(2)} (Annual Cap: ₹${capCheck.annualCap.toFixed(2)}, Current FY Spent: ₹${capCheck.spentFY.toFixed(2)}, Requested: ₹${capCheck.requestedAmount.toFixed(2)})`
      });
    }

    await request.update({ status: 'Approved' });

    res.json({
      success: true,
      message: 'Investment request approved successfully',
      data: formatInvestmentRequest(request)
    });
  } catch (error) {
    console.error('Approve investment request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// REJECT Request
const rejectInvestmentRequest = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { InvestmentRequest, Doctor } = models;
    const { id } = req.params;

    // Check roles
    const allowedRoles = ['Super Admin', 'Admin', 'State Head', 'Zonal Manager', 'Area Manager', 'Manager'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to reject requests' });
    }

    const request = await InvestmentRequest.findByPk(id, {
      include: [
        { model: Doctor, as: 'doctor', attributes: ['id', 'name'] },
        { 
          model: models.User, 
          as: 'user', 
          attributes: ['id', 'name', 'email', 'state_id', 'head_office_id'],
          include: [
            {
              model: models.HeadOffice,
              as: 'headOffices',
              attributes: ['id']
            }
          ]
        }
      ]
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Investment request not found' });
    }

    // For State Head, restrict rejection to requests within their assigned state
    if (req.user.role === 'State Head') {
      if (!req.user.state_id) {
        return res.status(400).json({ success: false, message: 'State Head user does not have an assigned state' });
      }
      if (request.user && request.user.state_id !== req.user.state_id) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only reject requests from your state' });
      }
    }

    // For Zonal Manager, Area Manager, and Manager, restrict to their head offices
    if (['Zonal Manager', 'Area Manager', 'Manager'].includes(req.user.role)) {
      // Find all head office IDs associated with the caller
      const userHeadOffices = await models.UserHeadOffice.findAll({
        where: { user_id: req.user.id },
        attributes: ['head_office_id']
      });
      const headOfficeIds = userHeadOffices.map(u => u.head_office_id);
      if (req.user.head_office_id) {
        headOfficeIds.push(req.user.head_office_id);
      }
      const uniqueHeadOfficeIds = Array.from(new Set(headOfficeIds));

      // Get head office IDs of the request's creator
      const creatorHeadOfficeIds = [];
      if (request.user) {
        if (request.user.head_office_id) {
          creatorHeadOfficeIds.push(request.user.head_office_id);
        }
        if (request.user.headOffices) {
          request.user.headOffices.forEach(h => creatorHeadOfficeIds.push(h.id));
        }
      }
      const uniqueCreatorHeadOfficeIds = Array.from(new Set(creatorHeadOfficeIds));

      const hasCommonHeadOffice = uniqueHeadOfficeIds.some(id => uniqueCreatorHeadOfficeIds.includes(id));
      if (!hasCommonHeadOffice) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only reject requests from users in your associated head offices' });
      }
    }

    const { rejection_reason } = req.body;

    await request.update({ 
      status: 'Rejected',
      rejection_reason: rejection_reason || null
    });

    // Refresh the request object to include newly updated fields in response
    await request.reload();

    res.json({
      success: true,
      message: 'Investment request rejected successfully',
      data: formatInvestmentRequest(request)
    });
  } catch (error) {
    console.error('Reject investment request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createInvestmentRequest,
  updateInvestmentRequest,
  getInvestmentRequests,
  getInvestmentRequestsByHeadOffice,
  approveInvestmentRequest,
  rejectInvestmentRequest,
  getDoctorCurrentMtdSupport,
  checkUcpmpAnnualCap
};
