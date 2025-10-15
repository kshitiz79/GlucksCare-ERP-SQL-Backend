// Migration to add indexes for version cleanup performance
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add indexes for better cleanup performance
    await queryInterface.addIndex('versions', ['user_id', 'created_at'], {
      name: 'idx_versions_user_created'
    });

    await queryInterface.addIndex('versions', ['user_id'], {
      name: 'idx_versions_user_id'
    });

    await queryInterface.addIndex('versions', ['created_at'], {
      name: 'idx_versions_created_at'
    });

    console.log('✅ Version table indexes added successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('versions', 'idx_versions_user_created');
    await queryInterface.removeIndex('versions', 'idx_versions_user_id');
    await queryInterface.removeIndex('versions', 'idx_versions_created_at');

    console.log('✅ Version table indexes removed successfully');
  }
};