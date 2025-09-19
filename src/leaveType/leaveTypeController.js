// GET all leave types
const getAllLeaveTypes = async (req, res) => {
  try {
    const { LeaveType } = req.app.get('models');
    const { isActive } = req.query;
    const whereClause = {};
    
    if (isActive !== undefined) {
      whereClause.is_active = isActive === 'true';
    }

    const leaveTypes = await LeaveType.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });

    // Format response to match frontend expectations
    const formattedLeaveTypes = leaveTypes.map(leaveType => ({
      _id: leaveType.id,
      name: leaveType.name,
      code: leaveType.code,
      description: leaveType.description,
      maxDaysPerYear: leaveType.max_days_per_year,
      maxConsecutiveDays: leaveType.max_consecutive_days,
      carryForward: leaveType.carry_forward,
      carryForwardLimit: leaveType.carry_forward_limit,
      encashable: leaveType.encashable,
      requiresDocuments: leaveType.requires_documents,
      documentTypes: leaveType.document_types,
      applicableFor: leaveType.applicable_for,
      minimumServiceMonths: leaveType.minimum_service_months,
      advanceApplication: leaveType.advance_application,
      isActive: leaveType.is_active,
      color: leaveType.color
    }));

    res.json({
      success: true,
      count: formattedLeaveTypes.length,
      data: formattedLeaveTypes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle leave type status
const toggleLeaveTypeStatus = async (req, res) => {
  try {
    const { LeaveType } = req.app.get('models');
    const { id } = req.params;
    
    const leaveType = await LeaveType.findByPk(id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }

    await leaveType.update({
      is_active: !leaveType.is_active,
      updated_by: req.user?.id || null
    });

    res.json({
      success: true,
      message: `Leave type ${leaveType.is_active ? 'activated' : 'deactivated'} successfully`,
      data: leaveType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET leave type by ID
const getLeaveTypeById = async (req, res) => {
  try {
    const { LeaveType } = req.app.get('models');
    const leaveType = await LeaveType.findByPk(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }
    res.json({
      success: true,
      data: leaveType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new leave type
const createLeaveType = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name || !req.body.code) {
      return res.status(400).json({
        success: false,
        message: 'Name and code are required fields'
      });
    }

    // Map frontend field names to database field names
    const leaveTypeData = {
      name: req.body.name,
      code: req.body.code,
      description: req.body.description || null,
      max_days_per_year: parseInt(req.body.maxDaysPerYear) || 0, // Required field, default to 0
      max_consecutive_days: req.body.maxConsecutiveDays ? parseInt(req.body.maxConsecutiveDays) : null,
      carry_forward: Boolean(req.body.carryForward),
      carry_forward_limit: req.body.carryForwardLimit ? parseInt(req.body.carryForwardLimit) : null,
      encashable: Boolean(req.body.encashable),
      requires_documents: Boolean(req.body.requiresDocuments),
      document_types: req.body.documentTypes || [],
      applicable_for: req.body.applicableFor || ['All'],
      minimum_service_months: req.body.minimumServiceMonths ? parseInt(req.body.minimumServiceMonths) : null,
      advance_application: req.body.advanceApplication ? parseInt(req.body.advanceApplication) : null,
      is_active: req.body.isActive !== undefined ? req.body.isActive : true,
      color: req.body.color || '#3B82F6',
      created_by: req.user?.id || null,
      updated_by: req.user?.id || null
    };

    const { LeaveType } = req.app.get('models');
    const leaveType = await LeaveType.create(leaveTypeData);
    res.status(201).json({
      success: true,
      data: leaveType
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a leave type
const updateLeaveType = async (req, res) => {
  try {
    const { LeaveType } = req.app.get('models');
    const leaveType = await LeaveType.findByPk(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }
    
    // Map frontend field names to database field names
    const updateData = {
      name: req.body.name,
      code: req.body.code,
      description: req.body.description || null,
      max_days_per_year: parseInt(req.body.maxDaysPerYear) || 0, // Required field, default to 0
      max_consecutive_days: req.body.maxConsecutiveDays ? parseInt(req.body.maxConsecutiveDays) : null,
      carry_forward: Boolean(req.body.carryForward),
      carry_forward_limit: req.body.carryForwardLimit ? parseInt(req.body.carryForwardLimit) : null,
      encashable: Boolean(req.body.encashable),
      requires_documents: Boolean(req.body.requiresDocuments),
      document_types: req.body.documentTypes || [],
      applicable_for: req.body.applicableFor || ['All'],
      minimum_service_months: req.body.minimumServiceMonths ? parseInt(req.body.minimumServiceMonths) : null,
      advance_application: req.body.advanceApplication ? parseInt(req.body.advanceApplication) : null,
      is_active: req.body.isActive !== undefined ? req.body.isActive : true,
      color: req.body.color || '#3B82F6',
      updated_by: req.user?.id || null
    };

    await leaveType.update(updateData);
    res.json({
      success: true,
      data: leaveType
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a leave type
const deleteLeaveType = async (req, res) => {
  try {
    const { LeaveType } = req.app.get('models');
    const leaveType = await LeaveType.findByPk(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }
    
    await leaveType.destroy();
    res.json({
      success: true,
      message: 'Leave type deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  toggleLeaveTypeStatus
};