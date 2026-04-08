const { sequelize, DoctorVisit } = require('./src/config/database');

const runSync = async () => {
    try {
        await DoctorVisit.sync({ alter: true });
        console.log('DoctorVisit synced!');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};
runSync();
