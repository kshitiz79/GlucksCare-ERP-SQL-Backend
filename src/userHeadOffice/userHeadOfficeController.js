// GET all user head offices
const getAllUserHeadOffices = async (req, res) => {
  try {
    const { UserHeadOffice } = req.app.get('models');
    const userHeadOffices = await UserHeadOffice.findAll();
    res.json({
      success: true,
      count: userHeadOffices.length,
      data: userHeadOffices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET user head office by ID
const getUserHeadOfficeById = async (req, res) => {
  try {
    const userHeadOffice = await UserHeadOffice.findByPk(req.params.id);
    if (!userHeadOffice) {
      return res.status(404).json({
        success: false,
        message: 'User head office not found'
      });
    }
    res.json({
      success: true,
      data: userHeadOffice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new user head office
const createUserHeadOffice = async (req, res) => {
  try {
    const userHeadOffice = await UserHeadOffice.create(req.body);
    res.status(201).json({
      success: true,
      data: userHeadOffice
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a user head office
const deleteUserHeadOffice = async (req, res) => {
  try {
    const userHeadOffice = await UserHeadOffice.findByPk(req.params.id);
    if (!userHeadOffice) {
      return res.status(404).json({
        success: false,
        message: 'User head office not found'
      });
    }

    await userHeadOffice.destroy();
    res.json({
      success: true,
      message: 'User head office deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllUserHeadOffices,
  getUserHeadOfficeById,
  createUserHeadOffice,
  deleteUserHeadOffice
};