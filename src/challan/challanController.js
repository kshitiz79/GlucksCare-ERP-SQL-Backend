const { Challan, ChallanItem, Product, InventoryItem, sequelize } = require('../config/database');

// Create a new challan (Sale)
exports.createChallan = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { party_id, party_name, party_type, challan_date, challan_number, total_amount, items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items provided' });
        }

        // 1. Create Challan Header
        const challan = await Challan.create({
            party_id,
            party_name,
            party_type,
            challan_date,
            challan_number,
            total_amount
        }, { transaction: t });

        // 2. Create items and DECREMENT stock
        for (const item of items) {
            await ChallanItem.create({
                challan_id: challan.id,
                product_id: item.product_id,
                product_name: item.product,
                qty: item.qty,
                rate: item.rate,
                total: Number(item.qty) * Number(item.rate)
            }, { transaction: t });

            // 3. Update Inventory Stock (Decrement for sale)
            const inventoryItem = await InventoryItem.findOne({
                where: { name: item.product },
                transaction: t
            });
            
            if (inventoryItem) {
                if (inventoryItem.total_stock < item.qty) {
                    throw new Error(`Insufficient stock for ${item.product}. Current stock: ${inventoryItem.total_stock}`);
                }
                await inventoryItem.decrement('total_stock', { by: item.qty, transaction: t });
            } else {
                throw new Error(`Product ${item.product} not found in inventory.`);
            }
        }

        await t.commit();
        res.status(201).json({ success: true, data: challan });
    } catch (error) {
        await t.rollback();
        console.error('Error creating challan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all challans
exports.getAllChallans = async (req, res) => {
    try {
        const challans = await Challan.findAll({
            include: [{ model: ChallanItem, as: 'items' }],
            order: [['challan_date', 'DESC']]
        });
        res.json({ success: true, data: challans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
