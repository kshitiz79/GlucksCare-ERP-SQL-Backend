// Sql-Backend/src/polygon/polygonController.js

const { Op } = require('sequelize');
const { importPolygonData } = require('../../scripts/importPolygons');

/**
 * Get territory polygons and boundary coordinates based on the Headquarter(s) assigned to the user.
 * Supports:
 * - Single HQ assigned via user.head_office_id
 * - Multiple HQs assigned via UserHeadOffice junction table (user.headOffices)
 * - Filtering by query params: headOfficeId, headOfficeIds, district, division, pincode
 * - Admin/Super Admin access with all=true or multi-HQ selection
 */
const getUserTerritoryPolygons = async (req, res) => {
  try {
    const models = req.app.get('models') || require('../config/database');
    const { Polygon, User, HeadOffice, Area } = models;

    // 1. Fetch user with assigned head offices
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: HeadOffice,
          as: 'headOffices',
          through: { attributes: [] }
        },
        {
          model: HeadOffice,
          foreignKey: 'head_office_id'
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 2. Resolve Head Office IDs (Multiple HQ Support)
    let assignedHQs = [];
    if (user.headOffices && user.headOffices.length > 0) {
      assignedHQs = [...user.headOffices];
    }
    if (user.HeadOffice && !assignedHQs.some(h => h.id === user.HeadOffice.id)) {
      assignedHQs.push(user.HeadOffice);
    } else if (user.head_office_id && !assignedHQs.some(h => h.id === user.head_office_id)) {
      const singleHq = await HeadOffice.findByPk(user.head_office_id);
      if (singleHq) assignedHQs.push(singleHq);
    }

    // Allow override via query params if provided
    let targetHeadOfficeIds = [];
    if (req.query.headOfficeIds) {
      const ids = Array.isArray(req.query.headOfficeIds)
        ? req.query.headOfficeIds
        : req.query.headOfficeIds.split(',').map(s => s.trim());
      targetHeadOfficeIds = ids;
    } else if (req.query.headOfficeId || req.query.head_office_id) {
      targetHeadOfficeIds = [(req.query.headOfficeId || req.query.head_office_id).trim()];
    } else {
      targetHeadOfficeIds = assignedHQs.map(h => h.id);
    }

    // If targetHeadOfficeIds were provided via query, fetch HQ details if not already in assignedHQs
    const activeHQs = await HeadOffice.findAll({
      where: { id: { [Op.in]: targetHeadOfficeIds } }
    });

    // 3. Build Polygon Where Clause
    const whereConditions = [];

    const isAdmin = ['Super Admin', 'Admin'].includes(user.role);
    const viewAll = req.query.all === 'true' && isAdmin;

    if (!viewAll) {
      if (targetHeadOfficeIds.length > 0) {
        // Collect HQ names / district keywords from active HQs for robust matching
        const districtNames = activeHQs.map(hq => {
          return hq.name.replace(/Head Office|Branch Office|Office/gi, '').trim();
        }).filter(Boolean);

        const hqOrConditions = [
          { head_office_id: { [Op.in]: targetHeadOfficeIds } }
        ];

        if (districtNames.length > 0) {
          districtNames.forEach(dist => {
            hqOrConditions.push({ district: { [Op.iLike]: `%${dist}%` } });
            hqOrConditions.push({ division: { [Op.iLike]: `%${dist}%` } });
          });
        }

        whereConditions.push({
          [Op.or]: hqOrConditions
        });
      } else if (!isAdmin) {
        // User has no headquarters assigned
        return res.json({
          success: true,
          count: 0,
          headquarters: [],
          message: 'No headquarters assigned to this user',
          geoJSON: {
            type: 'FeatureCollection',
            features: []
          },
          data: []
        });
      }
    }

    // Additional optional query filters
    if (req.query.pincode) {
      whereConditions.push({ pincode: req.query.pincode.trim() });
    }
    if (req.query.district) {
      whereConditions.push({ district: { [Op.iLike]: `%${req.query.district.trim()}%` } });
    }
    if (req.query.division) {
      whereConditions.push({ division: { [Op.iLike]: `%${req.query.division.trim()}%` } });
    }
    if (req.query.state) {
      whereConditions.push({ state: { [Op.iLike]: `%${req.query.state.trim()}%` } });
    }

    const whereClause = whereConditions.length > 0
      ? { [Op.and]: whereConditions }
      : {};

    // 4. Fetch Polygons
    const polygons = await Polygon.findAll({
      where: whereClause,
      include: [
        {
          model: HeadOffice,
          as: 'headOffice',
          attributes: ['id', 'name', 'pincode']
        }
      ],
      order: [
        ['district', 'ASC'],
        ['office_name', 'ASC']
      ]
    });

    // 5. Build GeoJSON FeatureCollection and flat data list
    const features = [];
    const formattedData = [];

    for (const poly of polygons) {
      const hqName = poly.headOffice?.name || (poly.head_office_id && activeHQs.find(h => h.id === poly.head_office_id)?.name) || '';

      const properties = {
        id: poly.id,
        pincode: poly.pincode,
        office_name: poly.office_name,
        post_office: poly.office_name,
        division: poly.division,
        district: poly.district,
        circle: poly.circle,
        state: poly.state,
        head_office_id: poly.head_office_id,
        head_office_name: hqName,
        latitude: poly.latitude,
        longitude: poly.longitude,
        ...(poly.properties || {})
      };

      features.push({
        type: 'Feature',
        id: poly.id,
        geometry: poly.geometry,
        properties
      });

      formattedData.push({
        id: poly.id,
        pincode: poly.pincode,
        office_name: poly.office_name,
        post_office: poly.office_name,
        division: poly.division,
        district: poly.district,
        circle: poly.circle,
        state: poly.state,
        head_office_id: poly.head_office_id,
        head_office_name: hqName,
        latitude: poly.latitude,
        longitude: poly.longitude,
        geometry: poly.geometry,
        coordinates: poly.coordinates || poly.geometry?.coordinates || []
      });
    }

    return res.json({
      success: true,
      count: polygons.length,
      headquarters: activeHQs.map(h => ({
        id: h.id,
        name: h.name,
        pincode: h.pincode,
        stateId: h.stateId
      })),
      geoJSON: {
        type: 'FeatureCollection',
        features
      },
      data: formattedData
    });
  } catch (error) {
    console.error('Error fetching territory polygons:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all polygons with optional search, filtering, and pagination
 */
const getAllPolygons = async (req, res) => {
  try {
    const models = req.app.get('models') || require('../config/database');
    const { Polygon, HeadOffice } = models;

    const {
      pincode,
      district,
      division,
      state,
      head_office_id,
      search,
      page = 1,
      limit = 100,
      format
    } = req.query;

    const where = {};
    if (pincode) where.pincode = pincode.trim();
    if (district) where.district = { [Op.iLike]: `%${district.trim()}%` };
    if (division) where.division = { [Op.iLike]: `%${division.trim()}%` };
    if (state) where.state = { [Op.iLike]: `%${state.trim()}%` };
    if (head_office_id) where.head_office_id = head_office_id.trim();

    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { office_name: { [Op.iLike]: term } },
        { pincode: { [Op.iLike]: term } },
        { district: { [Op.iLike]: term } },
        { division: { [Op.iLike]: term } }
      ];
    }

    const isAll = req.query.all === 'true';
    const parsedLimit = isAll ? 1000 : Math.min(parseInt(limit, 10) || 100, 1000);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    const { count, rows } = await Polygon.findAndCountAll({
      where,
      include: [
        {
          model: HeadOffice,
          as: 'headOffice',
          attributes: ['id', 'name', 'pincode']
        }
      ],
      limit: parsedLimit,
      offset: isAll ? undefined : offset,
      order: [['office_name', 'ASC']]
    });

    if (format === 'geojson') {
      const features = rows.map(poly => ({
        type: 'Feature',
        id: poly.id,
        geometry: poly.geometry,
        properties: {
          id: poly.id,
          pincode: poly.pincode,
          office_name: poly.office_name,
          post_office: poly.office_name,
          division: poly.division,
          district: poly.district,
          state: poly.state,
          head_office_id: poly.head_office_id,
          head_office_name: poly.headOffice?.name || '',
          latitude: poly.latitude,
          longitude: poly.longitude
        }
      }));

      return res.json({
        type: 'FeatureCollection',
        features
      });
    }

    return res.json({
      success: true,
      totalCount: count,
      page: parsedPage,
      totalPages: Math.ceil(count / parsedLimit),
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Error in getAllPolygons:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single polygon by ID
 */
const getPolygonById = async (req, res) => {
  try {
    const models = req.app.get('models') || require('../config/database');
    const { Polygon, HeadOffice } = models;

    const polygon = await Polygon.findByPk(req.params.id, {
      include: [
        {
          model: HeadOffice,
          as: 'headOffice',
          attributes: ['id', 'name', 'pincode']
        }
      ]
    });

    if (!polygon) {
      return res.status(404).json({
        success: false,
        message: 'Polygon not found'
      });
    }

    return res.json({
      success: true,
      data: polygon
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get polygon by Pincode
 */
const getPolygonByPincode = async (req, res) => {
  try {
    const models = req.app.get('models') || require('../config/database');
    const { Polygon, HeadOffice } = models;

    const polygon = await Polygon.findOne({
      where: { pincode: req.params.pincode.trim() },
      include: [
        {
          model: HeadOffice,
          as: 'headOffice',
          attributes: ['id', 'name', 'pincode']
        }
      ]
    });

    if (!polygon) {
      return res.status(404).json({
        success: false,
        message: `Polygon for pincode ${req.params.pincode} not found`
      });
    }

    return res.json({
      success: true,
      data: polygon
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get list of all districts with polygon and HQ counts
 */
const getDistricts = async (req, res) => {
  try {
    const models = req.app.get('models') || require('../config/database');
    const { Polygon, HeadOffice, sequelize } = models;

    const districts = await Polygon.findAll({
      attributes: [
        'district',
        'division',
        'head_office_id',
        [sequelize.fn('COUNT', sequelize.col('Polygon.id')), 'polygon_count']
      ],
      include: [
        {
          model: HeadOffice,
          as: 'headOffice',
          attributes: ['id', 'name', 'pincode']
        }
      ],
      group: ['Polygon.district', 'Polygon.division', 'Polygon.head_office_id', 'headOffice.id'],
      order: [['district', 'ASC']]
    });

    return res.json({
      success: true,
      count: districts.length,
      data: districts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Ingestion trigger endpoint (Admin/Super Admin only)
 */
const runPolygonIngestion = async (req, res) => {
  try {
    if (!['Super Admin', 'Admin'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Admin access required to trigger ingestion'
      });
    }

    const result = await importPolygonData({
      createAreas: req.body?.createAreas !== false
    });

    return res.json({
      success: true,
      message: 'Polygon ingestion executed successfully',
      result
    });
  } catch (error) {
    console.error('Ingestion endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getUserTerritoryPolygons,
  getAllPolygons,
  getPolygonById,
  getPolygonByPincode,
  getDistricts,
  runPolygonIngestion
};
