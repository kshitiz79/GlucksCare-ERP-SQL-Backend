const { DataTypes } = require('sequelize');

const Version = (sequelize) => {
  return sequelize.define('Version', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    current_version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        is: /^\d+\.\d+\.\d+$/
      }
    },
    play_store_version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        is: /^\d+\.\d+\.\d+$/
      }
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    device_info: {
      type: DataTypes.JSONB
    },
    build_number: {
      type: DataTypes.STRING(50)
    },
    update_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    update_type: {
      type: DataTypes.ENUM('none', 'optional', 'recommended', 'critical'),
      defaultValue: 'none'
    },
    version_check_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    last_check_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    check_count: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    last_update_prompt_date: {
      type: DataTypes.DATE
    },
    update_skipped: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    release_notes: {
      type: DataTypes.TEXT
    },
    minimum_required_version: {
      type: DataTypes.STRING(20),
      validate: {
        is: /^\d+\.\d+\.\d+$/
      }
    },
    force_update: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    created_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    updated_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'versions',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_versions_user_created',
        fields: ['user_id', 'created_at']
      },
      {
        name: 'idx_versions_user_id',
        fields: ['user_id']
      },
      {
        name: 'idx_versions_created_at',
        fields: ['created_at']
      }
    ]
  });
};

module.exports = Version;