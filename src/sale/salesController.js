const { Op } = require('sequelize');

// Record a new Sales entry
const createSale = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Sale, Doctor, Chemist } = models;
    const { doctorId, chemistId, amount, date, notes } = req.body;

    if (!doctorId && !chemistId) {
      return res.status(400).json({ success: false, message: 'Either Doctor ID or Chemist ID is required' });
    }

    if (amount === undefined || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    // Verify doctor exists if doctorId provided
    if (doctorId) {
      const doctor = await Doctor.findByPk(doctorId);
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }
    }

    // Verify chemist exists if chemistId provided
    if (chemistId) {
      const chemist = await Chemist.findByPk(chemistId);
      if (!chemist) {
        return res.status(404).json({ success: false, message: 'Chemist not found' });
      }
    }

    const sale = await Sale.create({
      doctor_id: doctorId || null,
      chemist_id: chemistId || null,
      amount: Number(amount),
      date: date || new Date().toISOString().split('T')[0],
      notes: notes || null,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Sales record created successfully',
      data: sale
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get sales history for a specific doctor
const getSalesByDoctor = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Sale, User } = models;
    const { doctorId } = req.params;

    const sales = await Sale.findAll({
      where: { doctor_id: doctorId },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [['date', 'DESC'], ['created_at', 'DESC']]
    });

    const formattedSales = sales.map(s => {
      const obj = s.toJSON();
      return {
        ...obj,
        creatorName: obj.creator ? obj.creator.name : 'System'
      };
    });

    res.json({
      success: true,
      data: formattedSales
    });
  } catch (error) {
    console.error('Fetch doctor sales error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get sales history for a specific chemist
const getSalesByChemist = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { Sale, User } = models;
    const { chemistId } = req.params;

    const sales = await Sale.findAll({
      where: { chemist_id: chemistId },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [['date', 'DESC'], ['created_at', 'DESC']]
    });

    const formattedSales = sales.map(s => {
      const obj = s.toJSON();
      return {
        ...obj,
        creatorName: obj.creator ? obj.creator.name : 'System'
      };
    });

    res.json({
      success: true,
      data: formattedSales
    });
  } catch (error) {
    console.error('Fetch chemist sales error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createSale,
  getSalesByDoctor,
  getSalesByChemist
};
