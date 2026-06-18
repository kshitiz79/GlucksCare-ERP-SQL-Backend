const { sequelize, TourPlan, TourPlanDay } = require('./src/config/database');

const syncTourPlans = async () => {
    try {
        await TourPlan.sync({ alter: true });
        await TourPlanDay.sync({ alter: true });
        console.log('✅ TourPlan and TourPlanDay tables synced successfully!');
    } catch (e) {
        console.error('❌ Error syncing TourPlan tables:', e);
    } finally {
        process.exit(0);
    }
};

syncTourPlans();
