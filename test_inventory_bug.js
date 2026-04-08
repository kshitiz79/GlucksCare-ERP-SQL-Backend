const { UserInventory, InventoryItem, User } = require('./src/config/database');

const testQuery = async () => {
    try {
        console.log('Testing UserInventory query...');
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
        console.log('Query succeeded, found:', inventory.length, 'entries');
    } catch (e) {
        console.error('Sequelize Error:', e);
    } finally {
        process.exit(0);
    }
};

testQuery();
