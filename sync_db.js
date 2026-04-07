const { sequelize, PartyExpense, Salt, Unit, StripSize, Hsn, Gst, PackSize, Product } = require('./src/config/database');

const syncAll = async () => {
    try {
        await PartyExpense.sync({ alter: true });
        await Salt.sync({ alter: true });
        await Unit.sync({ alter: true });
        await StripSize.sync({ alter: true });
        await Hsn.sync({ alter: true });
        await Gst.sync({ alter: true });
        await PackSize.sync({ alter: true });
        await Product.sync({ alter: true });
        console.log('All tables synced successfully!');
    } catch (e) {
        console.error('Error syncing:', e);
    } finally {
        process.exit(0);
    }
};

syncAll();
