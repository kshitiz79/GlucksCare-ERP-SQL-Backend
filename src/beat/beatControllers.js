const getMyBeats = async (req, res) => {
  try {
    const { Beat, Area } = req.app.get('models');
    const beats = await Beat.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Area,
          as: 'areas',
          attributes: ['id', 'name', 'pincode', 'post_office'],
          through: { attributes: [] } // Exclude junction table attributes
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      count: beats.length,
      data: beats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getBeatById = async (req, res) => {
  try {
    const { Beat, Area, User } = req.app.get('models');
    const beat = await Beat.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'employee_code', 'email', 'role']
        },
        {
          model: Area,
          as: 'areas',
          attributes: ['id', 'name', 'pincode', 'post_office'],
          through: { attributes: [] }
        }
      ]
    });

    if (!beat) {
      return res.status(404).json({
        success: false,
        message: 'Beat not found'
      });
    }

    // Check ownership (if not admin)
    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin' && beat.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this beat'
      });
    }

    res.json({
      success: true,
      data: beat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const createBeat = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  const t = await sequelize.transaction();

  try {
    const { Beat, BeatArea, Area } = req.app.get('models');
    const { name, area_ids } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Beat name is required'
      });
    }

    if (!area_ids || !Array.isArray(area_ids) || area_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one area must be assigned to the beat'
      });
    }

    // Check for duplicate areas in the input array
    const duplicateCheck = new Set();
    for (const areaId of area_ids) {
      if (duplicateCheck.has(areaId)) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate areas are not allowed in a beat'
        });
      }
      duplicateCheck.add(areaId);
    }

    // Verify all areas exist
    const areasCount = await Area.count({ where: { id: area_ids } });
    if (areasCount !== area_ids.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected areas do not exist in the database'
      });
    }

    // Create Beat
    const beat = await Beat.create({
      name,
      user_id: req.user.id
    }, { transaction: t });

    // Create BeatArea entries
    const beatAreasData = area_ids.map(areaId => ({
      beat_id: beat.id,
      area_id: areaId
    }));

    await BeatArea.bulkCreate(beatAreasData, { transaction: t });

    await t.commit();

    // Fetch newly created beat with areas loaded
    const createdBeat = await Beat.findByPk(beat.id, {
      include: [
        {
          model: Area,
          as: 'areas',
          attributes: ['id', 'name', 'pincode', 'post_office'],
          through: { attributes: [] }
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Beat created successfully',
      data: createdBeat
    });
  } catch (error) {
    await t.rollback();
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const updateBeat = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  const t = await sequelize.transaction();

  try {
    const { Beat, BeatArea, Area } = req.app.get('models');
    const { name, area_ids } = req.body;

    const beat = await Beat.findByPk(req.params.id);
    if (!beat) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Beat not found'
      });
    }

    // Check authorization (must be creator or admin)
    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin' && beat.user_id !== req.user.id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this beat'
      });
    }

    // If update name
    if (name) {
      if (!name.trim()) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Beat name cannot be empty'
        });
      }
      await beat.update({ name }, { transaction: t });
    }

    // If updating areas
    if (area_ids) {
      if (!Array.isArray(area_ids) || area_ids.length === 0) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'At least one area must be assigned to the beat'
        });
      }

      // Check for duplicates
      const duplicateCheck = new Set();
      for (const areaId of area_ids) {
        if (duplicateCheck.has(areaId)) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            message: 'Duplicate areas are not allowed in a beat'
          });
        }
        duplicateCheck.add(areaId);
      }

      // Verify all areas exist
      const areasCount = await Area.count({ where: { id: area_ids } });
      if (areasCount !== area_ids.length) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'One or more selected areas do not exist in the database'
        });
      }

      // Delete old beat areas
      await BeatArea.destroy({
        where: { beat_id: beat.id },
        transaction: t
      });

      // Create new beat areas
      const beatAreasData = area_ids.map(areaId => ({
        beat_id: beat.id,
        area_id: areaId
      }));

      await BeatArea.bulkCreate(beatAreasData, { transaction: t });
    }

    await t.commit();

    // Fetch updated beat with areas
    const updatedBeat = await Beat.findByPk(beat.id, {
      include: [
        {
          model: Area,
          as: 'areas',
          attributes: ['id', 'name', 'pincode', 'post_office'],
          through: { attributes: [] }
        }
      ]
    });

    res.json({
      success: true,
      message: 'Beat updated successfully',
      data: updatedBeat
    });
  } catch (error) {
    await t.rollback();
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const deleteBeat = async (req, res) => {
  try {
    const { Beat } = req.app.get('models');
    const beat = await Beat.findByPk(req.params.id);

    if (!beat) {
      return res.status(404).json({
        success: false,
        message: 'Beat not found'
      });
    }

    // Check authorization (must be creator or admin)
    if (req.user.role !== 'Admin' && req.user.role !== 'Super Admin' && beat.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this beat'
      });
    }

    await beat.destroy();

    res.json({
      success: true,
      message: 'Beat deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getAllBeatsAdmin = async (req, res) => {
  try {
    const { Beat, Area, User } = req.app.get('models');
    const beats = await Beat.findAll({
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'employee_code', 'email', 'role']
        },
        {
          model: Area,
          as: 'areas',
          attributes: ['id', 'name', 'pincode', 'post_office'],
          through: { attributes: [] }
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      count: beats.length,
      data: beats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getMyBeats,
  getBeatById,
  createBeat,
  updateBeat,
  deleteBeat,
  getAllBeatsAdmin
};
