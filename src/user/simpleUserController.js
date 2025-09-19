// SIMPLE USER DELETION - MONGODB STYLE
// No foreign key constraints, simple deletion

// DELETE a user - MongoDB Style (Simple deletion without foreign key constraints)
const deleteUserSimple = async (req, res) => {
  try {
    const models = req.app.get('models');
    const { User } = models;
    const sequelize = req.app.get('sequelize');
    
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`🗑️ Starting MongoDB-style deletion for user: ${req.params.id}`);

    // Step 1: Delete all personal data (like MongoDB - no foreign key constraints)
    const personalDataTables = [
      'expenses', 'attendance', 'locations', 'tickets', 'doctor_visits',
      'chemist_visits', 'stockist_visits', 'sales_activities', 'location_events',
      'location_history', 'notification_recipients', 'orders', 'sales_targets',
      'user_head_offices', 'user_managers', 'user_shifts', 'versions',
      'high_frequency_tracks', 'real_time_locations', 'stop_events', 'leaves'
    ];

    let deletedCounts = {};
    let clearedReferences = {};

    // Delete personal data
    for (const tableName of personalDataTables) {
      try {
        const [countResult] = await sequelize.query(`
          SELECT COUNT(*) as count FROM "${tableName}" WHERE "user_id" = :userId
        `, {
          replacements: { userId: req.params.id },
          type: sequelize.QueryTypes.SELECT
        });

        if (countResult.count > 0) {
          await sequelize.query(`
            DELETE FROM "${tableName}" WHERE "user_id" = :userId
          `, {
            replacements: { userId: req.params.id },
            type: sequelize.QueryTypes.DELETE
          });
          
          deletedCounts[tableName] = parseInt(countResult.count);
          console.log(`✅ Deleted ${countResult.count} records from ${tableName}`);
        }
      } catch (err) {
        console.log(`⚠️ Could not delete from ${tableName} (table may not exist):`, err.message);
      }
    }

    // Handle special cases
    const specialCases = [
      { table: 'leaves', column: 'employee_id' },
      { table: 'doctor_visit_history', column: 'sales_rep_id' },
      { table: 'visits', column: 'representative_id' },
      { table: 'visits', column: 'visited_with_coworker_id' }
    ];

    for (const special of specialCases) {
      try {
        const [count] = await sequelize.query(`
          SELECT COUNT(*) as count FROM "${special.table}" WHERE "${special.column}" = :userId
        `, {
          replacements: { userId: req.params.id },
          type: sequelize.QueryTypes.SELECT
        });

        if (count.count > 0) {
          await sequelize.query(`
            DELETE FROM "${special.table}" WHERE "${special.column}" = :userId
          `, {
            replacements: { userId: req.params.id },
            type: sequelize.QueryTypes.DELETE
          });
          deletedCounts[`${special.table}_${special.column}`] = parseInt(count.count);
          console.log(`✅ Deleted ${count.count} records from ${special.table}.${special.column}`);
        }
      } catch (err) {
        console.log(`⚠️ Could not delete from ${special.table}.${special.column}:`, err.message);
      }
    }

    // Step 2: Set audit trail fields to NULL (like "N/A")
    const auditFields = [
      { table: 'users', column: 'created_by' },
      { table: 'users', column: 'updated_by' },
      { table: 'attendance', column: 'approved_by' },
      { table: 'attendance', column: 'created_by' },
      { table: 'attendance', column: 'updated_by' },
      { table: 'shifts', column: 'created_by' },
      { table: 'shifts', column: 'updated_by' },
      { table: 'branches', column: 'created_by' },
      { table: 'branches', column: 'updated_by' },
      { table: 'departments', column: 'created_by' },
      { table: 'departments', column: 'updated_by' },
      { table: 'states', column: 'created_by' },
      { table: 'states', column: 'updated_by' },
      { table: 'notifications', column: 'sender_id' },
      { table: 'pdf_files', column: 'uploaded_by' }
    ];

    for (const audit of auditFields) {
      try {
        const [count] = await sequelize.query(`
          SELECT COUNT(*) as count FROM "${audit.table}" WHERE "${audit.column}" = :userId
        `, {
          replacements: { userId: req.params.id },
          type: sequelize.QueryTypes.SELECT
        });

        if (count.count > 0) {
          await sequelize.query(`
            UPDATE "${audit.table}" SET "${audit.column}" = NULL WHERE "${audit.column}" = :userId
          `, {
            replacements: { userId: req.params.id },
            type: sequelize.QueryTypes.UPDATE
          });
          clearedReferences[`${audit.table}.${audit.column}`] = parseInt(count.count);
          console.log(`✅ Set ${count.count} references to NULL in ${audit.table}.${audit.column}`);
        }
      } catch (err) {
        console.log(`⚠️ Could not clear ${audit.table}.${audit.column}:`, err.message);
      }
    }

    // Step 3: Delete the user (now safe - no foreign key constraints)
    console.log('🗑️ Deleting user record...');
    await user.destroy();
    console.log('✅ User deleted successfully');

    const totalPersonalRecords = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);
    const totalAuditReferences = Object.values(clearedReferences).reduce((sum, count) => sum + count, 0);

    res.json({
      success: true,
      message: '🎉 User deleted successfully! (MongoDB style - no foreign key constraints)',
      deletedRecords: {
        user: 1,
        personalData: deletedCounts,
        clearedAuditTrail: clearedReferences,
        summary: {
          totalPersonalRecords,
          totalAuditReferences,
          message: `Deleted ${totalPersonalRecords} personal records and cleared ${totalAuditReferences} audit references`
        }
      }
    });

  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete user'
    });
  }
};

module.exports = {
  deleteUserSimple
};