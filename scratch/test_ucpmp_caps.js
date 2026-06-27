const { sequelize, Doctor, InvestmentRequest, User } = require('../src/config/database');
const { checkUcpmpAnnualCap } = require('../src/investmentRequest/investmentRequestController');

async function test() {
  try {
    console.log("--- UCPMP CAPS TESTING ---");

    // Fetch or create user and doctor
    let user = await User.findOne({ where: { role: 'MR' } });
    if (!user) {
      user = await User.findOne();
    }
    console.log(`Using user: ${user.name}, ID: ${user.id}`);

    let doctor = await Doctor.findOne();
    console.log(`Using doctor: ${doctor.name}, ID: ${doctor.id}, Current Cap: ${doctor.ucpmp_annual_cap}`);

    // Update doctor cap specifically to ₹15,000
    await doctor.update({ ucpmp_annual_cap: 15000.00 });
    await doctor.reload();
    console.log(`Updated cap specifically: ${doctor.ucpmp_annual_cap} (expected: 15000)`);
    if (Number(doctor.ucpmp_annual_cap) !== 15000) {
      throw new Error("Specific cap update failed");
    }

    // Set globally to ₹12,000
    await Doctor.update({ ucpmp_annual_cap: 12000.00 }, { where: {} });
    await doctor.reload();
    console.log(`Updated cap globally: ${doctor.ucpmp_annual_cap} (expected: 12000)`);
    if (Number(doctor.ucpmp_annual_cap) !== 12000) {
      throw new Error("Global cap update failed");
    }

    // Test cap validation
    // Mock allocation under cap (e.g. ₹5,000)
    const capCheck1 = await checkUcpmpAnnualCap(
      { InvestmentRequest },
      doctor.id,
      'Cash',
      5000.00,
      [],
      doctor.ucpmp_annual_cap
    );
    console.log(`Cap check for ₹5,000 allocation: Exceeds = ${capCheck1.exceeds} (expected: false)`);
    if (capCheck1.exceeds) {
      throw new Error("Cap validation failed (under cap blocked)");
    }

    // Mock allocation over cap (e.g. ₹15,000)
    const capCheck2 = await checkUcpmpAnnualCap(
      { InvestmentRequest },
      doctor.id,
      'Cash',
      15000.00,
      [],
      doctor.ucpmp_annual_cap
    );
    console.log(`Cap check for ₹15,000 allocation: Exceeds = ${capCheck2.exceeds} (expected: true)`);
    if (!capCheck2.exceeds) {
      throw new Error("Cap validation failed (over cap allowed)");
    }

    console.log("✅ ALL UCPMP CAPS TESTING PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  } finally {
    process.exit();
  }
}

test();
