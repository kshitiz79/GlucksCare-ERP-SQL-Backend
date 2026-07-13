const getAllAreas = async (req, res) => {
  try {
    const { Area, HeadOffice, Beat } = req.app.get('models');
    const areas = await Area.findAll({
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Beat,
          as: 'beats',
          attributes: ['id', 'name', 'color'],
          through: { attributes: [] }
        }
      ],
      order: [['name', 'ASC']]
    });

    const formattedAreas = areas.map(area => {
      const areaJson = area.toJSON();
      areaJson.colors = areaJson.beats ? [...new Set(areaJson.beats.map(b => b.color).filter(Boolean))] : [];
      return areaJson;
    });

    res.json({
      success: true,
      count: formattedAreas.length,
      data: formattedAreas
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
    const { Area, HeadOffice, Beat } = req.app.get('models');
    const area = await Area.findByPk(req.params.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Beat,
          as: 'beats',
          attributes: ['id', 'name', 'color'],
          through: { attributes: [] }
        }
      ]
    });
    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }

    const formattedArea = area.toJSON();
    formattedArea.colors = formattedArea.beats ? [...new Set(formattedArea.beats.map(b => b.color).filter(Boolean))] : [];

    res.json({
      success: true,
      data: formattedArea
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
    const { Area, HeadOffice, Beat } = req.app.get('models');
    const { name, pincode, post_office, head_office_id, latitude, longitude, radius } = req.body;

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

    // Check if an area with this pincode and name already exists
    const existingArea = await Area.findOne({ where: { pincode, name } });
    if (existingArea) {
      return res.status(400).json({
        success: false,
        message: 'An area with this pincode and name already exists'
      });
    }

    const area = await Area.create({
      name,
      pincode,
      post_office,
      head_office_id,
      latitude: (latitude !== undefined && latitude !== '' && !isNaN(parseFloat(latitude))) ? parseFloat(latitude) : 0,
      longitude: (longitude !== undefined && longitude !== '' && !isNaN(parseFloat(longitude))) ? parseFloat(longitude) : 0,
      radius: (radius !== undefined && radius !== '' && !isNaN(parseInt(radius, 10))) ? parseInt(radius, 10) : 700
    });

    // Fetch the newly created area with HeadOffice and Beats loaded
    const createdArea = await Area.findByPk(area.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Beat,
          as: 'beats',
          attributes: ['id', 'name', 'color'],
          through: { attributes: [] }
        }
      ]
    });

    const formattedArea = createdArea.toJSON();
    formattedArea.colors = formattedArea.beats ? [...new Set(formattedArea.beats.map(b => b.color).filter(Boolean))] : [];

    res.status(201).json({
      success: true,
      data: formattedArea
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
    const { Area, HeadOffice, Beat } = req.app.get('models');
    const { name, pincode, post_office, head_office_id, latitude, longitude, radius } = req.body;

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

    const targetPincode = pincode !== undefined ? pincode : area.pincode;
    const targetName = name !== undefined ? name : area.name;

    if (targetPincode !== area.pincode || targetName !== area.name) {
      const { Op } = require('sequelize');
      const existingArea = await Area.findOne({
        where: {
          pincode: targetPincode,
          name: targetName,
          id: { [Op.ne]: area.id }
        }
      });
      if (existingArea) {
        return res.status(400).json({
          success: false,
          message: 'An area with this pincode and name already exists'
        });
      }
    }

    await area.update({
      name,
      pincode,
      post_office,
      head_office_id,
      latitude: (latitude !== undefined && latitude !== '' && !isNaN(parseFloat(latitude))) ? parseFloat(latitude) : area.latitude,
      longitude: (longitude !== undefined && longitude !== '' && !isNaN(parseFloat(longitude))) ? parseFloat(longitude) : area.longitude,
      radius: (radius !== undefined && radius !== '' && !isNaN(parseInt(radius, 10))) ? parseInt(radius, 10) : area.radius
    });

    // Fetch updated area with HeadOffice and Beats loaded
    const updatedArea = await Area.findByPk(area.id, {
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Beat,
          as: 'beats',
          attributes: ['id', 'name', 'color'],
          through: { attributes: [] }
        }
      ]
    });

    const formattedArea = updatedArea.toJSON();
    formattedArea.colors = formattedArea.beats ? [...new Set(formattedArea.beats.map(b => b.color).filter(Boolean))] : [];

    res.json({
      success: true,
      data: formattedArea
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

const getAreasByHeadOffice = async (req, res) => {
  try {
    const { Area, HeadOffice, Beat } = req.app.get('models');
    const { headOfficeId } = req.params;

    const areas = await Area.findAll({
      where: {
        head_office_id: headOfficeId
      },
      include: [
        {
          model: HeadOffice,
          as: 'HeadOffice',
          attributes: ['id', 'name']
        },
        {
          model: Beat,
          as: 'beats',
          attributes: ['id', 'name', 'color'],
          through: { attributes: [] }
        }
      ],
      order: [['name', 'ASC']]
    });

    const formattedAreas = areas.map(area => {
      const areaJson = area.toJSON();
      areaJson.colors = areaJson.beats ? [...new Set(areaJson.beats.map(b => b.color).filter(Boolean))] : [];
      return areaJson;
    });

    res.json({
      success: true,
      count: formattedAreas.length,
      data: formattedAreas
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
  deleteArea,
  getAreasByHeadOffice
};
