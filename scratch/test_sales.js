const { sequelize, Doctor, Sale, User } = require('../src/config/database');

async function test() {
  try {
    console.log("--- UNIFIED SALES TESTING ---");

    // Fetch test user and doctor
    let user = await User.findOne();
    let doctor = await Doctor.findOne();
    console.log(`Using doctor: ${doctor.name}, ID: ${doctor.id}`);

    // Pre-test cleanup
    await Sale.destroy({ where: { doctor_id: doctor.id } });

    // Create a mock sale for this doctor
    console.log("Recording a doctor sale of ₹45,000...");
    const sale = await Sale.create({
      doctor_id: doctor.id,
      amount: 45000.00,
      date: new Date().toISOString().split('T')[0],
      notes: 'Monthly prescription audit feedback business',
      created_by: user.id
    });
    console.log(`Sale recorded successfully! ID: ${sale.id}, Amount: ${sale.amount}`);

    // Call getSupportValueMtdMap to verify it calculates from sales table correctly
    const { getSupportValueMtdMap } = require('../src/doctor/doctorController');
    const mtdMap = await getSupportValueMtdMap({ Sale }, [doctor.id]);
    console.log(`Calculated dynamic Doctor MTD generated sales: ₹${mtdMap[doctor.id]}`);
    if (Number(mtdMap[doctor.id]) !== 45000) {
      throw new Error(`MTD calculation failed! Expected 45000, got ${mtdMap[doctor.id]}`);
    }
    console.log("✅ Dynamic MTD Calculation from Sales table verified successfully!");

    // Clean up
    await sale.destroy();
    console.log("Cleanup completed.");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  } finally {
    process.exit();
  }
}

test();
