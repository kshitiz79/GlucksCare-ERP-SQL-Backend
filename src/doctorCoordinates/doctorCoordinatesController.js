const { Op } = require('sequelize');
const concaveman = require('concaveman');

/**
 * Utility to calculate outer concave/convex hull boundary coordinates
 * for an array of doctor objects with latitude and longitude.
 */
const calculateOuterBoundary = (doctors, concavity = 2, lengthThreshold = 0) => {
  // 1. Filter out doctors missing valid non-zero lat/long
  const validDoctors = (doctors || []).filter(d => {
    const lat = parseFloat(d.latitude);
    const lng = parseFloat(d.longitude);
    return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
  });

  if (validDoctors.length === 0) {
    return {
      outerCoordinates: [],
      geoJSON: null
    };
  }

  // 2. Format unique 2D points [longitude, latitude] for concaveman
  const pointsMap = new Map();
  const points = [];

  validDoctors.forEach(d => {
    const lat = parseFloat(d.latitude);
    const lng = parseFloat(d.longitude);
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    if (!pointsMap.has(key)) {
      pointsMap.set(key, d);
      points.push([lng, lat]);
    }
  });

  // If fewer than 3 unique points, hull polygon cannot be formed; return valid points as-is
  if (points.length < 3) {
    const outerCoordinates = points.map(([lng, lat]) => {
      const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
      const doc = pointsMap.get(key);
      return {
        name: doc ? doc.name : '',
        pincode: doc ? (doc.pincode || doc.areaPincode || '') : '',
        latitude: lat,
        longitude: lng
      };
    });

    return {
      outerCoordinates,
      geoJSON: {
        type: 'Feature',
        geometry: {
          type: points.length === 1 ? 'Point' : 'MultiPoint',
          coordinates: points.length === 1 ? points[0] : points
        },
        properties: { pointCount: points.length }
      }
    };
  }

  // 3. Compute concave hull ring coordinates using concaveman
  const parsedConcavity = isNaN(Number(concavity)) ? 2 : Number(concavity);
  const parsedLengthThreshold = isNaN(Number(lengthThreshold)) ? 0 : Number(lengthThreshold);
  const hullRing = concaveman(points, parsedConcavity, parsedLengthThreshold);

  // 4. Transform hull points to structured output
  const outerCoordinates = hullRing.map(([lng, lat]) => {
    const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    const doc = pointsMap.get(key);
    return {
      name: doc ? doc.name : 'Boundary Point',
      latitude: lat,
      longitude: lng
    };
  });

  const geoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [hullRing]
    },
    properties: {
      pointCount: hullRing.length,
      concavity: parsedConcavity,
      lengthThreshold: parsedLengthThreshold
    }
  };

  return {
    outerCoordinates,
    geoJSON
  };
};

/**
 * API 1: Get list of all areas with assigned doctors (Only Name, Pincode, Latitude, Longitude)
 * Endpoint: GET /api/doctor-coordinates/areas
 */
const getAreasWithDoctorCoordinates = async (req, res) => {
  try {
    const { Area, Doctor, User, HeadOffice } = req.app.get('models');

    // 1. Get user's assigned head offices if authenticated
    let headOfficeIds = [];
    if (req.user && req.user.id) {
      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: HeadOffice,
            as: 'headOffices',
            through: { attributes: [] }
          }
        ]
      });

      if (user) {
        if (user.headOffices && user.headOffices.length > 0) {
          headOfficeIds = user.headOffices.map(office => office.id);
        } else if (user.head_office_id) {
          headOfficeIds = [user.head_office_id];
        }
      }
    }

    // 2. Build where filter for Area
    const areaWhere = {};
    if (headOfficeIds.length > 0) {
      areaWhere.head_office_id = { [Op.in]: headOfficeIds };
    }

    // 3. Fetch areas with included doctors
    const areas = await Area.findAll({
      where: areaWhere,
      attributes: ['id', 'name', 'pincode', 'latitude', 'longitude'],
      include: [
        {
          model: Doctor,
          as: 'Doctors',
          attributes: ['id', 'name', 'latitude', 'longitude']
        }
      ],
      order: [['name', 'ASC']]
    });

    // 4. Format output to contain ONLY name, pincode, latitude, longitude
    const formattedData = areas.map(area => {
      const areaObj = area.toJSON ? area.toJSON() : area;
      const doctorsList = (areaObj.Doctors || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        pincode: area.pincode,
        latitude: parseFloat(doc.latitude) || 0,
        longitude: parseFloat(doc.longitude) || 0
      }));

      return {
        id: area.id,
        name: area.name,
        pincode: area.pincode,
        latitude: parseFloat(area.latitude) || 0,
        longitude: parseFloat(area.longitude) || 0,
        doctors: doctorsList
      };
    });

    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * API 2: Get doctors by area pincode (Only Name, Pincode, Latitude, Longitude)
 * Endpoint: GET /api/doctor-coordinates/by-pincode/:pincode or GET /api/doctor-coordinates/by-pincode?pincode=...
 */
const getDoctorsByPincode = async (req, res) => {
  try {
    const { Area, Doctor } = req.app.get('models');

    const pincode = req.params.pincode || req.query.pincode;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is required as a route parameter or query parameter (e.g. /by-pincode/110001 or /by-pincode?pincode=110001)'
      });
    }

    // 1. Fetch areas matching pincode with assigned doctors
    const areas = await Area.findAll({
      where: {
        pincode: pincode.toString().trim()
      },
      attributes: ['id', 'name', 'pincode', 'latitude', 'longitude'],
      include: [
        {
          model: Doctor,
          as: 'Doctors',
          attributes: ['id', 'name', 'latitude', 'longitude']
        }
      ],
      order: [['name', 'ASC']]
    });

    if (!areas || areas.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No area found for pincode: ${pincode}`,
        pincode: pincode,
        doctors: []
      });
    }

    // 2. Format output to contain ONLY doctor name, pincode, latitude, and longitude
    const doctors = [];
    areas.forEach(area => {
      const areaObj = area.toJSON ? area.toJSON() : area;
      (areaObj.Doctors || []).forEach(doc => {
        doctors.push({
          id: doc.id,
          name: doc.name,
          pincode: area.pincode,
          latitude: parseFloat(doc.latitude) || 0,
          longitude: parseFloat(doc.longitude) || 0
        });
      });
    });

    res.json({
      success: true,
      pincode: pincode,
      count: doctors.length,
      doctors: doctors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * API 3: Get outermost boundary coordinates (hull) for a specific area ID
 * Endpoint: GET /api/doctor-coordinates/area-boundary/:areaId
 */
const getAreaBoundaryById = async (req, res) => {
  try {
    const { Area, Doctor } = req.app.get('models');
    const { areaId } = req.params;
    const { concavity, lengthThreshold } = req.query;

    const area = await Area.findByPk(areaId, {
      attributes: ['id', 'name', 'pincode', 'latitude', 'longitude'],
      include: [
        {
          model: Doctor,
          as: 'Doctors',
          attributes: ['id', 'name', 'latitude', 'longitude']
        }
      ]
    });

    if (!area) {
      return res.status(404).json({
        success: false,
        message: 'Area not found'
      });
    }

    const areaObj = area.toJSON ? area.toJSON() : area;
    const doctors = (areaObj.Doctors || []).map(d => ({ ...d, areaPincode: area.pincode }));
    const boundary = calculateOuterBoundary(doctors, concavity, lengthThreshold);

    res.json({
      success: true,
      id: area.id,
      name: area.name,
      pincode: area.pincode,
      totalDoctors: doctors.length,
      outerCoordinates: boundary.outerCoordinates,
      geoJSON: boundary.geoJSON
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * API 4: Get outermost boundary coordinates (hull) for doctors by pincode
 * Endpoint: GET /api/doctor-coordinates/boundary/by-pincode/:pincode or GET /api/doctor-coordinates/boundary/by-pincode?pincode=...
 */
const getBoundaryByPincode = async (req, res) => {
  try {
    const { Area, Doctor } = req.app.get('models');
    const pincode = req.params.pincode || req.query.pincode;
    const { concavity, lengthThreshold } = req.query;

    if (!pincode) {
      return res.status(400).json({
        success: false,
        message: 'Pincode is required as a route or query parameter'
      });
    }

    const areas = await Area.findAll({
      where: { pincode: pincode.toString().trim() },
      attributes: ['id', 'name', 'pincode', 'latitude', 'longitude'],
      include: [
        {
          model: Doctor,
          as: 'Doctors',
          attributes: ['id', 'name', 'latitude', 'longitude']
        }
      ]
    });

    if (!areas || areas.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No area found for pincode: ${pincode}`,
        pincode: pincode,
        outerCoordinates: [],
        geoJSON: null
      });
    }

    const allDoctors = [];
    areas.forEach(area => {
      const areaObj = area.toJSON ? area.toJSON() : area;
      (areaObj.Doctors || []).forEach(doc => {
        allDoctors.push({ ...doc, areaPincode: area.pincode });
      });
    });

    const boundary = calculateOuterBoundary(allDoctors, concavity, lengthThreshold);

    res.json({
      success: true,
      pincode: pincode,
      totalDoctors: allDoctors.length,
      outerCoordinates: boundary.outerCoordinates,
      geoJSON: boundary.geoJSON
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * API 5: Get outermost boundary coordinates (hull) for all areas
 * Endpoint: GET /api/doctor-coordinates/area-boundaries
 */
const getAreaBoundariesAll = async (req, res) => {
  try {
    const { Area, Doctor, User, HeadOffice } = req.app.get('models');
    const { concavity, lengthThreshold } = req.query;

    let headOfficeIds = [];
    if (req.user && req.user.id) {
      const user = await User.findByPk(req.user.id, {
        include: [{ model: HeadOffice, as: 'headOffices', through: { attributes: [] } }]
      });
      if (user) {
        if (user.headOffices && user.headOffices.length > 0) {
          headOfficeIds = user.headOffices.map(office => office.id);
        } else if (user.head_office_id) {
          headOfficeIds = [user.head_office_id];
        }
      }
    }

    const areaWhere = {};
    if (headOfficeIds.length > 0) {
      areaWhere.head_office_id = { [Op.in]: headOfficeIds };
    }

    const areas = await Area.findAll({
      where: areaWhere,
      attributes: ['id', 'name', 'pincode', 'latitude', 'longitude'],
      include: [
        {
          model: Doctor,
          as: 'Doctors',
          attributes: ['id', 'name', 'latitude', 'longitude']
        }
      ],
      order: [['name', 'ASC']]
    });

    const data = areas.map(area => {
      const areaObj = area.toJSON ? area.toJSON() : area;
      const doctors = (areaObj.Doctors || []).map(d => ({ ...d, areaPincode: area.pincode }));
      const boundary = calculateOuterBoundary(doctors, concavity, lengthThreshold);

      return {
        id: area.id,
        name: area.name,
        pincode: area.pincode,
        totalDoctors: doctors.length,
        outerCoordinates: boundary.outerCoordinates,
        geoJSON: boundary.geoJSON
      };
    });

    res.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAreasWithDoctorCoordinates,
  getDoctorsByPincode,
  getAreaBoundaryById,
  getBoundaryByPincode,
  getAreaBoundariesAll
};
