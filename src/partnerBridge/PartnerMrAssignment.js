const { DataTypes } = require('sequelize');

const PartnerMrAssignment = (sequelize) => {
  return sequelize.define('PartnerMrAssignment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    partnerType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'partner_type',
      validate: {
        isIn: [['doctor', 'chemist', 'stockist']]
      }
    },
    partnerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'partner_id'
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    headOfficeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'head_office_id',
      references: {
        model: 'head_offices',
        key: 'id'
      }
    },
    linkedStockistId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'linked_stockist_id',
      references: {
        model: 'stockists',
        key: 'id'
      }
    },
    assignedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'assigned_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'partner_mr_assignments',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['partner_type', 'partner_id'],
        name: 'idx_pma_type_partner_unique'
      },
      {
        fields: ['user_id'],
        name: 'idx_pma_user_id'
      },
      {
        fields: ['head_office_id'],
        name: 'idx_pma_head_office_id'
      },
      {
        fields: ['linked_stockist_id'],
        name: 'idx_pma_linked_stockist_id'
      }
    ]
  });
};

module.exports = PartnerMrAssignment;
