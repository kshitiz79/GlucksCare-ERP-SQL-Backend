const { DataTypes } = require('sequelize');

const VisitProductAgreed = (sequelize) => {
  const VisitProductAgreedModel = sequelize.define('VisitProductAgreed', {
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
    tableName: 'visit_products_agreed',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['visit_id', 'product_id']
      }
    ]
  });

  return VisitProductAgreedModel;
};

module.exports = VisitProductAgreed;