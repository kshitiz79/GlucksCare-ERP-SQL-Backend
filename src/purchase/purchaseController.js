const { Purchase, PurchaseItem, Product, InventoryItem, sequelize } = require('../config/database');

// Create a new purchase
exports.createPurchase = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { party_id, party_name, party_type, purchase_date, bill_number, total_amount, remarks, items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items provided for purchase' });
        }

        // 1. Create Purchase Header
        const purchase = await Purchase.create({
            party_id,
            party_name,
            party_type,
            purchase_date,
            bill_number,
            total_amount,
            remarks
        }, { transaction: t });

        // 2. Create Purchase Items and update Inventory
        for (const item of items) {
            await PurchaseItem.create({
                purchase_id: purchase.id,
                product_id: item.product_id,
                product_name: item.product,
                qty: item.qty,
                rate: item.rate,
                mrp: item.mrp,
                total: Number(item.qty) * Number(item.rate)
            }, { transaction: t });

            // 3. Update Inventory Stock (Optional: logic depends on how you handle overall stock)
            // Here we check if the product name exists in InventoryItems and update/create it
            const [inventoryItem, created] = await InventoryItem.findOrCreate({
                where: { name: item.product },
                defaults: { 
                    total_stock: 0,
                    product_id: item.product_id
                },
                transaction: t
            });
            
            // Ensure product_id is set if it was NULL (for existing legacy records)
            if (!inventoryItem.product_id && item.product_id) {
                await inventoryItem.update({ product_id: item.product_id }, { transaction: t });
            }

            
            await inventoryItem.increment('total_stock', { by: item.qty, transaction: t });
        }

        await t.commit();
        res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        await t.rollback();
        console.error('Error creating purchase:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all purchases
exports.getAllPurchases = async (req, res) => {
    try {
        const purchases = await Purchase.findAll({
            include: [{
                model: PurchaseItem,
                as: 'items'
            }],
            order: [['purchase_date', 'DESC'], ['created_at', 'DESC']]
        });
        res.json({ success: true, data: purchases });
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get purchase by ID
exports.getPurchaseById = async (req, res) => {
    try {
        const purchase = await Purchase.findByPk(req.params.id, {
            include: [{
                model: PurchaseItem,
                as: 'items'
            }]
        });
        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Purchase not found' });
        }
        res.json({ success: true, data: purchase });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
