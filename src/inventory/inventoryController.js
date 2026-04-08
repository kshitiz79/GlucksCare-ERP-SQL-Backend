const { InventoryItem, UserInventory, User, DoctorVisit, Doctor, sequelize } = require('../config/database');
const { Op } = require('sequelize');

exports.createInventoryItem = async (req, res) => {
  try {
    const { name, description, total_stock } = req.body;
    
    const item = await InventoryItem.create({
      name,
      description,
      total_stock: parseInt(total_stock) || 0
    });
    
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInventoryItems = async (req, res) => {
  try {
    const items = await InventoryItem.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignInventoryToUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { item_id, user_id, quantity } = req.body;
    
    const item = await InventoryItem.findByPk(item_id, { transaction });
    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    
    const qty = parseInt(quantity);
    if (item.total_stock < qty) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Not enough stock in admin account' });
    }
    
    let userInv = await UserInventory.findOne({
      where: { user_id, inventory_item_id: item_id },
      transaction
    });
    
    if (userInv) {
      userInv.assigned_stock += qty;
      await userInv.save({ transaction });
    } else {
      userInv = await UserInventory.create({
        user_id,
        inventory_item_id: item_id,
        assigned_stock: qty
      }, { transaction });
    }
    
    item.total_stock -= qty;
    await item.save({ transaction });
    
    await transaction.commit();
    res.status(200).json({ success: true, message: 'Assigned successfully', data: userInv });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserInventory = async (req, res) => {
  try {
    const user_id = req.params.user_id || req.user.id;
    
    const inventory = await UserInventory.findAll({
      where: { user_id },
      include: [{
        model: InventoryItem,
        as: 'inventoryItem',
        attributes: ['id', 'name', 'description']
      }]
    });
    
    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllAssignments = async (req, res) => {
  try {
    const inventory = await UserInventory.findAll({
      include: [
        {
          model: InventoryItem,
          as: 'inventoryItem',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'employee_code']
        }
      ]
    });
    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllGiftDistribution = async (req, res) => {
  try {
    const visits = await DoctorVisit.findAll({
      where: {
        gifts_given: {
          [Op.not]: null
        }
      },
      include: [
        {
          model: Doctor,
          as: 'DoctorInfo',
          attributes: ['id', 'name', 'specialization', 'headOfficeId']
        },
        {
          model: User,
          as: 'UserInfo',
          attributes: ['id', 'name', 'employee_code', 'role']
        }
      ],
      order: [['date', 'DESC']]
    });
    
    // Transform visits down to individual gift records for easy table display
    let giftRecords = [];
    
    for (const visit of visits) {
       if (visit.gifts_given && Array.isArray(visit.gifts_given)) {
          for (const gift of visit.gifts_given) {
             giftRecords.push({
                visit_id: visit.id,
                date: visit.date,
                latitude: visit.latitude,
                longitude: visit.longitude,
                doctor: visit.DoctorInfo,
                user: visit.UserInfo,
                item_id: gift.item_id,
                quantity: gift.quantity
             });
          }
       }
    }

    // Now populate item names
    const items = await InventoryItem.findAll();
    const itemMap = {};
    items.forEach(i => itemMap[i.id] = i.name);
    
    giftRecords = giftRecords.map(record => ({
       ...record,
       item_name: itemMap[record.item_id] || 'Unknown Item'
    }));

    res.status(200).json({ success: true, data: giftRecords });
  } catch (error) {
    console.error("Gift distribution error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
