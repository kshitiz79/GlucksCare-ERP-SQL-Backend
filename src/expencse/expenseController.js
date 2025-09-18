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
    const { Expense, User } = req.app.get('models');
    const { 
      userId, 
      category, 
      description, 
      bill, 
      status = 'pending', 
      amount, 
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

    // Calculate travel details if it's a travel expense
    let totalDistance = 0;
    let ratePerKm = 2.40;
    
    if (category === 'travel' && travelDetails) {
      totalDistance = travelDetails.reduce((sum, leg) => sum + (Number(leg.km) || 0), 0);
    }

    const expenseData = {
      user_id: userId,
      user_name: user.name,
      category,
      description,
      bill,
      status,
      amount: Number(amount),
      travel_details: category === 'travel' ? travelDetails : [],
      rate_per_km: ratePerKm,
      total_distance_km: totalDistance,
      daily_allowance_type: category === 'daily' ? dailyAllowanceType : null,
      date: new Date().toISOString().split('T')[0]
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
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE an expense
const updateExpense = async (req, res) => {
  try {
    const { Expense } = req.app.get('models');
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      });
    }
    
    await expense.update(req.body);
    
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

module.exports = {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense
};