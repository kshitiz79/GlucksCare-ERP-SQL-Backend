const { DataTypes } = require('sequelize');

const Visit = (sequelize) => {
  return sequelize.define('Visit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    representative_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    representative_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    area_territory: {
      type: DataTypes.STRING(255)
    },
    visited_with_coworker_id: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    doctor_chemist_name: {
      type: DataTypes.STRING(255)
    },
    specialisation: {
      type: DataTypes.STRING(255)
    },
    total_number_of_visits: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    purpose_of_visit: {
      type: DataTypes.TEXT
    },
    key_discussion_points: {
      type: DataTypes.TEXT
    },
    doctor_interest_level: {
      type: DataTypes.STRING(100)
    },
    doctor_queries: {
      type: DataTypes.TEXT
    },
    expected_monthly_volume: {
      type: DataTypes.STRING(100)
    },
    actual_orders_sales: {
      type: DataTypes.TEXT
    },
    competitor_brands: {
      type: DataTypes.TEXT
    },
    reasons_for_preferring_competitor: {
      type: DataTypes.TEXT
    },
    market_feedback: {
      type: DataTypes.TEXT
    },
    challenges_faced: {
      type: DataTypes.TEXT
    },
    additional_notes: {
      type: DataTypes.TEXT
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected'),
      defaultValue: 'submitted'
    }
  }, {
    tableName: 'visits',
    timestamps: true,
    underscored: true
  });
};

module.exports = Visit;