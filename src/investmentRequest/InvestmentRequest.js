const { DataTypes } = require('sequelize');

const InvestmentRequest = (sequelize) => {
  const model = sequelize.define('InvestmentRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    doctor_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'doctors',
        key: 'id'
      }
    },
    support_value_mtd: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    payment_mode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: {
          args: [['Cash', 'NEFT', 'UPI', 'Items/Gift']],
          msg: 'Payment mode must be Cash, NEFT, UPI, or Items/Gift'
        }
      }
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    purpose: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    bank_details: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    payment_proof: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    upi_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    items: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    justification: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Pending',
      validate: {
        isIn: {
          args: [['Draft', 'Pending', 'Approved', 'Rejected']],
          msg: 'Status must be Draft, Pending, Approved, or Rejected'
        }
      }
    }
  }, {
    tableName: 'investment_requests',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return model;
};

module.exports = InvestmentRequest;
