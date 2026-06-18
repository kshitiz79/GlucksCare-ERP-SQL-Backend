const { sequelize, Beat, BeatArea } = require('./src/config/database');

const syncBeats = async () => {
    try {
        await Beat.sync({ alter: true });
        await BeatArea.sync({ alter: true });
        console.log('✅ Beat and BeatArea tables synced successfully!');
    } catch (e) {
        console.error('❌ Error syncing Beat tables:', e);
    } finally {
        process.exit(0);
    }
};

syncBeats();
