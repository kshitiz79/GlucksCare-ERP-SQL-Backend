const getAllAreas = async (req, res) => {
  try {
    const { Area, HeadOffice } = req.app.get('models');
    const areas = await Area.findAll({
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        }
      ],
      order: [['name', 'ASC']]
    });
    res.json({
      success: true,
      count: areas.length,
      data: areas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getAreaById = async (req, res) => {
  try {
    const { Area, HeadOffice } = req.app.get('models');
    const area = await Area.findByPk(req.params.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        }
      ]
    });
    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }
    res.json({
      success: true,
      data: area
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const createArea = async (req, res) => {
  try {
    const { Area, HeadOffice } = req.app.get('models');
    const { name, pincode, post_office, head_office_id } = req.body;

    if (!name || !pincode || !post_office || !head_office_id) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, pincode, post_office, head_office_id'
      });
    }

    // Verify HeadOffice exists
    const headOffice = await HeadOffice.findByPk(head_office_id);
    if (!headOffice) {
      return res.status(404).json({
        success: false,
        message: 'Head Office not found'
      });
    }

    const area = await Area.create({
      name,
      pincode,
      post_office,
      head_office_id
    });

    // Fetch the newly created area with HeadOffice loaded
    const createdArea = await Area.findByPk(area.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(201).json({
      success: true,
      data: createdArea
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const updateArea = async (req, res) => {
  try {
    const { Area, HeadOffice } = req.app.get('models');
    const { name, pincode, post_office, head_office_id } = req.body;

    const area = await Area.findByPk(req.params.id);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }

    if (head_office_id) {
      const headOffice = await HeadOffice.findByPk(head_office_id);
      if (!headOffice) {
        return res.status(404).json({
          success: false,
          message: 'Head Office not found'
        });
      }
    }

    await area.update({
      name,
      pincode,
      post_office,
      head_office_id
    });

    // Fetch updated area with HeadOffice loaded
    const updatedArea = await Area.findByPk(area.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        }
      ]
    });

    res.json({
      success: true,
      data: updatedArea
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const deleteArea = async (req, res) => {
  try {
    const { Area } = req.app.get('models');
    const area = await Area.findByPk(req.params.id);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }

    await area.destroy();
    res.json({
      success: true,
      message: 'Area deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea
};
