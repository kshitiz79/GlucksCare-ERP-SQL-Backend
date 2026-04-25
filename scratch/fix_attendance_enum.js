const { sequelize } = require('../src/config/database');

async function fix() {
  try {
    console.log('Attempting to update attendance status values in database...');
    
    // 1. Try adding values to the Sequelize-generated ENUM type if it exists
    const enumQueries = [
      "ALTER TYPE \"enum_attendance_status\" ADD VALUE IF NOT EXISTS 'week_off'",
      "ALTER TYPE \"enum_attendance_status\" ADD VALUE IF NOT EXISTS 'holiday'"
    ];

    for (const q of enumQueries) {
      try {
        await sequelize.query(q);
        console.log(`Success: ${q}`);
      } catch (e) {
        console.log(`Note: Could not update ENUM type (may already exist or use different type name): ${e.message}`);
      }
    }

    // 2. Update the CHECK constraint on the attendance table
    // PostgreSQL usually names this constraint 'attendance_status_check' if defined manually or by older version of Sequelize
    try {
      await sequelize.query("ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check");
      await sequelize.query(`
        ALTER TABLE attendance 
        ADD CONSTRAINT attendance_status_check 
        CHECK (status IN ('present', 'absent', 'half_day', 'late', 'on_leave', 'punched_in', 'punched_out', 'week_off', 'holiday'))
      `);
      console.log('Success: Updated CHECK constraint "attendance_status_check"');
    } catch (e) {
      console.log(`Note: Could not update CHECK constraint (may not exist or use different name): ${e.message}`);
    }

    console.log('\nDatabase update completed. Please restart your backend server if it doesn\'t pick up the changes automatically.');
  } catch (err) {
    console.error('Migration script failed:', err);
  } finally {
    process.exit();
  }
}

fix();
