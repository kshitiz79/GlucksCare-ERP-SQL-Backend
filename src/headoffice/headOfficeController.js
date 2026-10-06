// GET all head offices
const getAllHeadOffices = async (req, res) => {
  try {
    // Get the HeadOffice and State models from app context
    const { HeadOffice, State } = req.app.get('models');
    const headOffices = await HeadOffice.findAll({
      include: [
        {
          model: State,
          as: 'State',
          attributes: ['id', 'name', 'code']
        }
      ]
    });
    res.json({
      success: true,
      count: headOffices.length,
      data: headOffices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET head office by ID
const getHeadOfficeById = async (req, res) => {
  try {
    // Get the HeadOffice and State models from app context
    const { HeadOffice, State } = req.app.get('models');
    const headOffice = await HeadOffice.findByPk(req.params.id, {
      include: [
        {
          model: State,
          as: 'State',
          attributes: ['id', 'name', 'code']
        }
      ]
    });
    if (!headOffice) {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }
    res.json({
      success: true,
      data: headOffice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET head offices by state for State Head users
const getHeadOfficesByStateForStateHead = async (req, res) => {
  try {
    // Get the HeadOffice, State, and User models from app context
    const { HeadOffice, State, User } = req.app.get('models');
    
    // Check if user is a State Head
    if (req.user.role !== 'State Head') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only State Head users can access this endpoint.'
      });
    }
    
    // Get the state assigned to this State Head user
    const stateHeadUser = await User.findByPk(req.user.id);
    if (!stateHeadUser || !stateHeadUser.state_id) {
      return res.status(400).json({
        success: false,
        message: 'State Head user does not have a state assigned.'
      });
    }
    
    // Find all head offices belonging to this state
    const headOffices = await HeadOffice.findAll({
      where: {
        stateId: stateHeadUser.state_id
      },
      include: [
        {
          model: State,
          as: 'State',
          attributes: ['id', 'name', 'code']
        }
      ]
    });
    
    res.json({
      success: true,
      count: headOffices.length,
      data: headOffices
    });
  } catch (error) {
    console.error('Error fetching head offices by state:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new head office
const createHeadOffice = async (req, res) => {
  try {
    // Get the HeadOffice model from app context
    const { HeadOffice } = req.app.get('models');
    
    // Only allow specific fields to be set
    const allowedFields = ['name', 'stateId', 'pincode', 'latitude', 'longitude'];
    const headOfficeData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        headOfficeData[field] = req.body[field];
      }
    });
    
    const headOffice = await HeadOffice.create(headOfficeData);
    res.status(201).json({
      success: true,
      data: headOffice
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a head office
const updateHeadOffice = async (req, res) => {
  try {
    // Get the HeadOffice model from app context
    const { HeadOffice } = req.app.get('models');
    const headOffice = await HeadOffice.findByPk(req.params.id);
    if (!headOffice) {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }
    
    // Only allow specific fields to be updated
    const allowedFields = ['name', 'stateId', 'pincode', 'latitude', 'longitude'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    await headOffice.update(updateData);
    res.json({
      success: true,
      data: headOffice
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a head office
const deleteHeadOffice = async (req, res) => {
  try {
    // Get the HeadOffice model from app context
    const { HeadOffice } = req.app.get('models');
    const headOffice = await HeadOffice.findByPk(req.params.id);
    if (!headOffice) {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }
    
    await headOffice.destroy();
    res.json({
      success: true,
      message: 'Head office deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// BULK CREATE head offices (supports nested areas list per head office)
const createBulkHeadOffices = async (req, res) => {
  const sequelize = req.app.get('sequelize');
  const t = await sequelize.transaction();

  try {
    const { HeadOffice, State, Area } = req.app.get('models');

    // Extract list
    const items = Array.isArray(req.body)
      ? req.body
      : (req.body.headOffices || req.body.head_offices || req.body.data || []);

    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Request body must be an array of head offices or contain a "headOffices" array'
      });
    }

    if (items.length > 500) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot upload more than 500 head offices at once'
      });
    }

    // Default stateId if provided at root level
    const defaultStateId = req.body.stateId || req.body.state_id || null;

    // Cache all states for fast lookup by ID, Name, or Code
    const allStates = State ? await State.findAll({ attributes: ['id', 'name', 'code'] }) : [];
    const stateMap = new Map();
    allStates.forEach(s => {
      if (s.id) stateMap.set(String(s.id).toLowerCase(), s.id);
      if (s.name) stateMap.set(String(s.name).trim().toLowerCase(), s.id);
      if (s.code) stateMap.set(String(s.code).trim().toLowerCase(), s.id);
    });

    const results = [];
    const errors = [];
    let createdHoCount = 0;
    let existingHoCount = 0;
    let createdAreaCount = 0;
    let updatedAreaCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 1;

      if (!item || typeof item !== 'object') {
        errors.push(`Row ${rowNum}: Invalid head office item`);
        continue;
      }

      const name = item.name ? String(item.name).trim() : '';
      if (!name) {
        errors.push(`Row ${rowNum}: Head office name is required`);
        continue;
      }

      // Resolve stateId
      let resolvedStateId = null;
      const stateInput = item.stateId || item.state_id || item.state || item.stateName || defaultStateId;
      if (stateInput) {
        const key = String(stateInput).trim().toLowerCase();
        if (stateMap.has(key)) {
          resolvedStateId = stateMap.get(key);
        } else {
          resolvedStateId = stateInput;
        }
      }

      const pincode = item.pincode !== undefined && item.pincode !== null ? String(item.pincode).trim() : null;
      const latitude = (item.latitude !== undefined && item.latitude !== '' && !isNaN(parseFloat(item.latitude))) ? parseFloat(item.latitude) : 0;
      const longitude = (item.longitude !== undefined && item.longitude !== '' && !isNaN(parseFloat(item.longitude))) ? parseFloat(item.longitude) : 0;
      const isActive = item.is_active !== undefined ? Boolean(item.is_active) : (item.isActive !== undefined ? Boolean(item.isActive) : true);

      // Check if head office already exists by name (and optionally stateId)
      let headOffice = await HeadOffice.findOne({
        where: {
          name,
          ...(resolvedStateId ? { stateId: resolvedStateId } : {})
        },
        transaction: t
      });

      let isNewHo = false;
      if (!headOffice) {
        headOffice = await HeadOffice.create({
          name,
          stateId: resolvedStateId,
          pincode,
          latitude,
          longitude,
          is_active: isActive
        }, { transaction: t });
        createdHoCount++;
        isNewHo = true;
      } else {
        const updates = {};
        if (pincode && !headOffice.pincode) updates.pincode = pincode;
        if (latitude !== 0 && (!headOffice.latitude || headOffice.latitude === 0)) updates.latitude = latitude;
        if (longitude !== 0 && (!headOffice.longitude || headOffice.longitude === 0)) updates.longitude = longitude;
        if (Object.keys(updates).length > 0) {
          await headOffice.update(updates, { transaction: t });
        }
        existingHoCount++;
      }

      // Handle nested areas list if provided
      const rawAreas = item.areas || item.areaList || item.area_list || [];
      const processedAreas = [];

      if (Array.isArray(rawAreas) && rawAreas.length > 0 && Area) {
        for (let j = 0; j < rawAreas.length; j++) {
          const areaItem = rawAreas[j];
          if (!areaItem) continue;

          let aName = '';
          let aPincode = pincode || '000000';
          let aPostOffice = '';
          let aLat = latitude;
          let aLng = longitude;
          let aRadius = 700;

          if (typeof areaItem === 'string') {
            aName = areaItem.trim();
            aPostOffice = aName;
          } else if (typeof areaItem === 'object') {
            aName = areaItem.name ? String(areaItem.name).trim() : '';
            aPincode = areaItem.pincode ? String(areaItem.pincode).trim() : (pincode || '000000');
            aPostOffice = areaItem.post_office ? String(areaItem.post_office).trim() : (areaItem.postOffice ? String(areaItem.postOffice).trim() : aName);
            if (areaItem.latitude !== undefined && areaItem.latitude !== '' && !isNaN(parseFloat(areaItem.latitude))) {
              aLat = parseFloat(areaItem.latitude);
            }
            if (areaItem.longitude !== undefined && areaItem.longitude !== '' && !isNaN(parseFloat(areaItem.longitude))) {
              aLng = parseFloat(areaItem.longitude);
            }
            if (areaItem.radius !== undefined && !isNaN(parseInt(areaItem.radius, 10))) {
              aRadius = parseInt(areaItem.radius, 10);
            }
          }

          if (!aName) continue;

          // Check if area already exists by (pincode, name)
          let existingArea = await Area.findOne({
            where: {
              pincode: aPincode,
              name: aName
            },
            transaction: t
          });

          if (existingArea) {
            await existingArea.update({
              head_office_id: headOffice.id,
              post_office: aPostOffice || existingArea.post_office,
              latitude: aLat !== 0 ? aLat : existingArea.latitude,
              longitude: aLng !== 0 ? aLng : existingArea.longitude,
              radius: aRadius
            }, { transaction: t });
            updatedAreaCount++;
            processedAreas.push(existingArea);
          } else {
            const newArea = await Area.create({
              name: aName,
              pincode: aPincode,
              post_office: aPostOffice || aName,
              head_office_id: headOffice.id,
              latitude: aLat,
              longitude: aLng,
              radius: aRadius,
              is_active: true
            }, { transaction: t });
            createdAreaCount++;
            processedAreas.push(newArea);
          }
        }
      }

      results.push({
        ...headOffice.toJSON(),
        isNew: isNewHo,
        areasCount: processedAreas.length,
        areas: processedAreas
      });
    }

    if (errors.length > 0 && results.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'All head offices failed validation',
        errors
      });
    }

    await t.commit();

    res.status(201).json({
      success: true,
      message: `Processed ${results.length} head offices (${createdHoCount} created, ${existingHoCount} existing) and ${createdAreaCount + updatedAreaCount} areas (${createdAreaCount} created, ${updatedAreaCount} updated)`,
      summary: {
        totalHeadOffices: results.length,
        createdHeadOffices: createdHoCount,
        existingHeadOffices: existingHoCount,
        totalAreas: createdAreaCount + updatedAreaCount,
        createdAreas: createdAreaCount,
        updatedAreas: updatedAreaCount,
        errorsCount: errors.length
      },
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    await t.rollback();
    console.error('Error in createBulkHeadOffices:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during bulk head office creation'
    });
  }
};

module.exports = {
  getAllHeadOffices,
  getHeadOfficeById,
  getHeadOfficesByStateForStateHead,
  createHeadOffice,
  createBulkHeadOffices,
  updateHeadOffice,
  deleteHeadOffice
};