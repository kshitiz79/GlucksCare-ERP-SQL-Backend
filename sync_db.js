const db = require('./src/config/database');
const { sequelize, PartyExpense } = db;

async function syncDb() {
  try {
    await PartyExpense.sync({ alter: true });
    console.log("PartyExpense table synced successfully!");
  } catch (error) {
    console.error("Error syncing PartyExpensetable:", error);
  } finally {
    process.exit(0);
  }
}

syncDb();
