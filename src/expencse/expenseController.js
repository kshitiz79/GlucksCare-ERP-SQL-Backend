const cloudinary = require('../config/cloudinary');

// Helper function to upload image to Cloudinary
const uploadToCloudinary = async (imageData, isBase64 = true) => {
  try {
    let uploadData;
    
    if (isBase64) {
      // Handle base64 data
      uploadData = imageData;
    } else {
      // Handle buffer data from multer
      uploadData = `data:${imageData.mimetype};base64,${imageData.buffer.toString('base64')}`;
    }
    
    const result = await cloudinary.uploader.upload(uploadData, { 
      folder: 'expenses',
      resource_type: 'auto'
    });
    
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
};

// GET all expenses
const getAllExpenses = async (req, res) => {
  try {
    const { Expense, User } = req.app.get('models');
    const { userId } = req.query;
    
    let whereClause = {};
    if (userId) {
      whereClause.user_id = userId;
    }
    
    const expenses = await Expense.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'UserInfo',
        attributes: ['id', 'name', 'email']
      }],
      order: [['created_at', 'DESC']]
    });

    // Transform the response to match frontend expectations
    const transformedExpenses = expenses.map(expense => {
      const expenseObj = expense.toJSON();
      return {
        ...expenseObj,
        _id: expenseObj.id, // For compatibility with frontend
        user: expenseObj.user_id,
        userName: expenseObj.user_name || (expenseObj.UserInfo ? expenseObj.UserInfo.name : 'Unknown User'),
        totalDistanceKm: expenseObj.total_distance_km,
        ratePerKm: expenseObj.rate_per_km,
        travelDetails: expenseObj.travel_details,
        dailyAllowanceType: expenseObj.daily_allowance_type,
        // Remove the nested object
        UserInfo: undefined
      };
    });

    res.json(transformedExpenses);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET expense by ID
const getExpenseById = async (req, res) => {
  try {
    const { Expense, User } = req.app.get('models');
    const expense = await Expense.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'UserInfo',
        attributes: ['id', 'name', 'email']
      }]
    });
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    // Transform the response
    const expenseObj = expense.toJSON();
    const transformedExpense = {
      ...expenseObj,
      _id: expenseObj.id,
      user: expenseObj.user_id,
      userName: expenseObj.user_name || (expenseObj.UserInfo ? expenseObj.UserInfo.name : 'Unknown User'),
      totalDistanceKm: expenseObj.total_distance_km,
      ratePerKm: expenseObj.rate_per_km,
      travelDetails: expenseObj.travel_details,
      dailyAllowanceType: expenseObj.daily_allowance_type,
      UserInfo: undefined
    };

    res.json({
      success: true,
      data: transformedExpense
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new expense
const createExpense = async (req, res) => {
  try {
    const { Expense, User, ExpenseSetting } = req.app.get('models');
    const { 
      userId, 
      category, 
      description, 
      bill, 
      status = 'pending', 
      travelDetails, 
      dailyAllowanceType 
    } = req.body;

    // Get user info
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get expense settings
    const settings = await ExpenseSetting.findOne() || {
      rate_per_km: 2.40,
      head_office_amount: 150,
      outside_head_office_amount: 175
    };

    // Handle bill upload to Cloudinary
    let billUrl = '';
    if (bill) {
      try {
        billUrl = await uploadToCloudinary(bill, true);
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: uploadError.message
        });
      }
    }

    // Handle file upload from multer (if file is uploaded via form-data)
    if (req.file) {
      try {
        billUrl = await uploadToCloudinary(req.file, false);
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: uploadError.message
        });
      }
    }

    // Calculate amount based on category
    let computedAmount = 0;
    let totalDistance = 0;
    let ratePerKm = settings.rate_per_km || 2.40;
    
    if (category === 'travel' && Array.isArray(travelDetails)) {
      totalDistance = travelDetails.reduce((sum, leg) => sum + (Number(leg.km) || 0), 0);
      computedAmount = totalDistance * ratePerKm;
    } else if (category === 'daily') {
      computedAmount = dailyAllowanceType === 'headoffice' 
        ? (settings.head_office_amount || 150)
        : (settings.outside_head_office_amount || 175);
    }

    const expenseData = {
      user_id: userId,
      user_name: user.name,
      category,
      description,
      bill: billUrl,
      status,
      amount: computedAmount,
      travel_details: category === 'travel' ? travelDetails : [],
      rate_per_km: ratePerKm,
      total_distance_km: totalDistance,
      daily_allowance_type: category === 'daily' ? dailyAllowanceType : null,
      date: new Date().toISOString().split('T')[0],
      edit_count: 0
    };

    const expense = await Expense.create(expenseData);
    
    // Transform response
    const expenseObj = expense.toJSON();
    const transformedExpense = {
      ...expenseObj,
      _id: expenseObj.id,
      user: expenseObj.user_id,
      userName: expenseObj.user_name,
      totalDistanceKm: expenseObj.total_distance_km,
      ratePerKm: expenseObj.rate_per_km,
      travelDetails: expenseObj.travel_details,
      dailyAllowanceType: expenseObj.daily_allowance_type
    };

    res.status(201).json(transformedExpense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE an expense
const updateExpense = async (req, res) => {
  try {
    const { Expense, ExpenseSetting } = req.app.get('models');
    const { 
      userId, 
      category, 
      description, 
      bill, 
      travelDetails, 
      dailyAllowanceType 
    } = req.body;

    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }

    // Check if expense can be edited
    if (expense.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only edit pending expenses'
      });
    }

    if (expense.edit_count >= 1) {
      return res.status(400).json({
        success: false,
        message: 'Expense can only be edited once'
      });
    }

    if (userId && expense.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit this expense'
      });
    }

    // Get expense settings
    const settings = await ExpenseSetting.findOne() || {
      rate_per_km: 2.40,
      head_office_amount: 150,
      outside_head_office_amount: 175
    };

    // Handle bill upload to Cloudinary if new bill provided
    let billUrl = expense.bill;
    if (bill && bill !== expense.bill) {
      try {
        billUrl = await uploadToCloudinary(bill, true);
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: uploadError.message
        });
      }
    }

    // Handle file upload from multer (if file is uploaded via form-data)
    if (req.file) {
      try {
        billUrl = await uploadToCloudinary(req.file, false);
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: uploadError.message
        });
      }
    }

    // Calculate amount based on category
    let computedAmount = 0;
    let totalDistance = 0;
    let ratePerKm = settings.rate_per_km || 2.40;
    
    if (category === 'travel' && Array.isArray(travelDetails)) {
      totalDistance = travelDetails.reduce((sum, leg) => sum + (Number(leg.km) || 0), 0);
      computedAmount = totalDistance * ratePerKm;
    } else if (category === 'daily') {
      computedAmount = dailyAllowanceType === 'headoffice' 
        ? (settings.head_office_amount || 150)
        : (settings.outside_head_office_amount || 175);
    }

    // Update expense data
    const updateData = {
      category,
      description,
      bill: billUrl,
      amount: computedAmount,
      travel_details: category === 'travel' ? travelDetails : [],
      rate_per_km: ratePerKm,
      total_distance_km: totalDistance,
      daily_allowance_type: category === 'daily' ? dailyAllowanceType : null,
      edit_count: expense.edit_count + 1
    };

    await expense.update(updateData);
    
    // Transform response
    const expenseObj = expense.toJSON();
    const transformedExpense = {
      ...expenseObj,
      _id: expenseObj.id,
      user: expenseObj.user_id,
      userName: expenseObj.user_name,
      totalDistanceKm: expenseObj.total_distance_km,
      ratePerKm: expenseObj.rate_per_km,
      travelDetails: expenseObj.travel_details,
      dailyAllowanceType: expenseObj.daily_allowance_type
    };

    res.json(transformedExpense);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE an expense
const deleteExpense = async (req, res) => {
  try {
    const { Expense } = req.app.get('models');
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }
    
    await expense.destroy();
    res.json({
      success: true,
      message: 'Expense record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// APPROVE an expense
const approveExpense = async (req, res) => {
  try {
    const { Expense } = req.app.get('models');
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }
    
    await expense.update({ status: 'approved' });
    
    // Transform response
    const expenseObj = expense.toJSON();
    const transformedExpense = {
      ...expenseObj,
      _id: expenseObj.id,
      user: expenseObj.user_id,
      userName: expenseObj.user_name,
      totalDistanceKm: expenseObj.total_distance_km,
      ratePerKm: expenseObj.rate_per_km,
      travelDetails: expenseObj.travel_details,
      dailyAllowanceType: expenseObj.daily_allowance_type
    };

    res.json(transformedExpense);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// REJECT an expense
const rejectExpense = async (req, res) => {
  try {
    const { Expense } = req.app.get('models');
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }
    
    await expense.update({ status: 'rejected' });
    
    // Transform response
    const expenseObj = expense.toJSON();
    const transformedExpense = {
      ...expenseObj,
      _id: expenseObj.id,
      user: expenseObj.user_id,
      userName: expenseObj.user_name,
      totalDistanceKm: expenseObj.total_distance_km,
      ratePerKm: expenseObj.rate_per_km,
      travelDetails: expenseObj.travel_details,
      dailyAllowanceType: expenseObj.daily_allowance_type
    };

    res.json(transformedExpense);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET expense settings
const getExpenseSettings = async (req, res) => {
  try {
    const { ExpenseSetting } = req.app.get('models');
    const settings = await ExpenseSetting.findOne();
    
    if (!settings) {
      return res.json({
        ratePerKm: 2.40,
        headOfficeAmount: 150,
        outsideHeadOfficeAmount: 175,
      });
    }

    // Transform response to match frontend expectations
    const transformedSettings = {
      ratePerKm: settings.rate_per_km,
      headOfficeAmount: settings.head_office_amount,
      outsideHeadOfficeAmount: settings.outside_head_office_amount,
    };

    res.json(transformedSettings);
  } catch (error) {
    console.error('Get expense settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE expense settings
const updateExpenseSettings = async (req, res) => {
  try {
    const { ExpenseSetting } = req.app.get('models');
    const { ratePerKm, headOfficeAmount, outsideHeadOfficeAmount } = req.body;
    
    let settings = await ExpenseSetting.findOne();
    
    if (!settings) {
      settings = await ExpenseSetting.create({
        rate_per_km: ratePerKm,
        head_office_amount: headOfficeAmount,
        outside_head_office_amount: outsideHeadOfficeAmount
      });
    } else {
      await settings.update({
        rate_per_km: ratePerKm,
        head_office_amount: headOfficeAmount,
        outside_head_office_amount: outsideHeadOfficeAmount
      });
    }

    // Transform response to match frontend expectations
    const transformedSettings = {
      ratePerKm: settings.rate_per_km,
      headOfficeAmount: settings.head_office_amount,
      outsideHeadOfficeAmount: settings.outside_head_office_amount,
    };

    res.json(transformedSettings);
  } catch (error) {
    console.error('Update expense settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// UPLOAD bill image
const uploadBillImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const imageUrl = await uploadToCloudinary(req.file, false);
    
    res.json({
      success: true,
      imageUrl: imageUrl,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Upload bill image error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  getExpenseSettings,
  updateExpenseSettings,
  uploadBillImage
};