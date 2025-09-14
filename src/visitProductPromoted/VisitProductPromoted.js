const { DataTypes } = require('sequelize');

const VisitProductPromoted = (sequelize) => {
  const VisitProductPromotedModel = sequelize.define('VisitProductPromoted', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    visit_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    tableName: 'visit_products_promoted',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['visit_id', 'product_id']
      }
    ]
  });

  return VisitProductPromotedModel;
};

module.exports = VisitProductPromoted;