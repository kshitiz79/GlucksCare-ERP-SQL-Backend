const { sequelize, InventoryItem, UserInventory } = require('./src/config/database');

const syncInventory = async () => {
    try {
        await InventoryItem.sync({ alter: true });
        await UserInventory.sync({ alter: true });
        console.log('Inventory tables synced successfully!');
    } catch (e) {
        console.error('Error syncing:', e);
    } finally {
        process.exit(0);
    }
};

syncInventory();
