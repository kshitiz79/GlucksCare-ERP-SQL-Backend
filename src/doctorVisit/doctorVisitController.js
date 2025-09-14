const Doctor = require('../doctor/Doctor');
const User = require('../user/User');

// Haversine formula for distance calculation
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

// GET all doctor visits
const getAllDoctorVisits = async (req, res) => {
  try {
    const { DoctorVisit } = req.app.get('models'); // Get DoctorVisit model from app context
    const doctorVisits = await DoctorVisit.findAll();
    res.json({
      success: true,
      count: doctorVisits.length,
      data: doctorVisits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET doctor visit by ID
const getDoctorVisitById = async (req, res) => {
  try {
    const { DoctorVisit } = req.app.get('models'); // Get DoctorVisit model from app context
    const doctorVisit = await DoctorVisit.findByPk(req.params.id);
    if (!doctorVisit) {
      return res.status(404).json({
        success: false,
        message: 'Doctor visit not found'
      });
    }
    res.json({
      success: true,
      data: doctorVisit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CREATE a new doctor visit
const createDoctorVisit = async (req, res) => {
  try {
    const { DoctorVisit, Doctor, User } = req.app.get('models'); // Get models from app context
    const { doctor_id, user_id, date, notes, product_id, remark } = req.body;

    // Validate doctor exists
    const doctor = await Doctor.findByPk(doctor_id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Validate user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const doctorVisit = await DoctorVisit.create({
      doctor_id,
      user_id,
      date,
      notes,
      product_id: product_id || null,
      remark: remark || null
    });

    res.status(201).json({
      success: true,
      data: doctorVisit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// UPDATE a doctor visit
const updateDoctorVisit = async (req, res) => {
  try {
    const { DoctorVisit } = req.app.get('models'); // Get DoctorVisit model from app context
    const doctorVisit = await DoctorVisit.findByPk(req.params.id);
    if (!doctorVisit) {
      return res.status(404).json({
        success: false,
        message: 'Doctor visit not found'
      });
    }
    
    await doctorVisit.update(req.body);
    res.json({
      success: true,
      data: doctorVisit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// DELETE a doctor visit
const deleteDoctorVisit = async (req, res) => {
  try {
    const { DoctorVisit } = req.app.get('models'); // Get DoctorVisit model from app context
    const doctorVisit = await DoctorVisit.findByPk(req.params.id);
    if (!doctorVisit) {
      return res.status(404).json({
        success: false,
        message: 'Doctor visit not found'
      });
    }
    
    await doctorVisit.destroy();
    res.json({
      success: true,
      message: 'Doctor visit deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// CONFIRM a doctor visit
const confirmDoctorVisit = async (req, res) => {
  try {
    const { DoctorVisit, Product, Doctor } = req.app.get('models'); // Get models from app context
    const { id } = req.params;
    let { userLatitude, userLongitude, product_id, remark } = req.body;

    const visit = await DoctorVisit.findByPk(id, {
      include: [{
        model: Doctor,
        as: 'DoctorInfo'
      }]
    });
    
    if (!visit) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found'
      });
    }

    // Get doctor information
    const doctor = visit.DoctorInfo;
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Check if doctor's location is available for distance calculation
    if (doctor.latitude && doctor.longitude) {
      // Calculate distance
      const distance = getDistance(
        userLatitude,
        userLongitude,
        doctor.latitude,
        doctor.longitude
      );

      // Check if distance is within 200 meters
      if (distance > 200) {
        return res.status(200).json({
          status: false,
          success: false,
          message: `You are ${Math.round(distance)} meters away from the doctor's location. Please be within 200 meters to confirm the visit.`,
          distance: Math.round(distance)
        });
      }
    } else {
      // Log that doctor's location is not available, but proceed with confirmation
      console.log(`Doctor ${doctor.id} has no location data. Skipping distance check.`);
    }

    // Validate product if provided
    if (product_id) {
      const product = await Product.findByPk(product_id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      visit.product_id = product_id;
    }

    // Update remark if provided
    if (remark) {
      visit.remark = remark;
    }

    // Confirm the visit and save user's location
    visit.confirmed = true;
    visit.latitude = userLatitude || null;
    visit.longitude = userLongitude || null;
    
    await visit.save();

    res.status(200).json({
      status: true,
      success: true,
      message: 'Visit confirmed successfully',
      visit: visit
    });
  } catch (error) {
    console.error('Confirm visit error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// GET visits by user ID
const getDoctorVisitsByUserId = async (req, res) => {
  try {
    const { DoctorVisit, Doctor } = req.app.get('models'); // Get DoctorVisit and Doctor models from app context
    const { userId } = req.params;
    
    const visits = await DoctorVisit.findAll({
      where: { user_id: userId },
      include: [{
        model: Doctor,
        as: 'DoctorInfo',  // Use the correct alias
        attributes: ['id', 'name', 'specialization']
      }]
    });

    // Transform the response to match the expected format
    const transformedVisits = visits.map(visit => {
      const visitObj = visit.toJSON();
      return {
        ...visitObj,
        doctor: visitObj.DoctorInfo || null,
        // Remove the nested object
        DoctorInfo: undefined
      };
    });

    res.json(transformedVisits);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllDoctorVisits,
  getDoctorVisitById,
  createDoctorVisit,
  updateDoctorVisit,
  deleteDoctorVisit,
  confirmDoctorVisit,
  getDoctorVisitsByUserId
};