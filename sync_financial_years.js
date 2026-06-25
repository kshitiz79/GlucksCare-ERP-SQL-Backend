const { sequelize, FinancialYear } = require('./src/config/database');

const syncFinancialYears = async () => {
    try {
        await FinancialYear.sync({ alter: true });
        console.log('✅ FinancialYear table synced successfully!');
    } catch (e) {
        console.error('❌ Error syncing FinancialYear table:', e);
    } finally {
        process.exit(0);
    }
};

syncFinancialYears();
