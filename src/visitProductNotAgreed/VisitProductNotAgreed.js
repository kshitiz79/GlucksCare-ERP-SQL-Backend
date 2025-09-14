const { DataTypes } = require('sequelize');

const VisitProductNotAgreed = (sequelize) => {
  const VisitProductNotAgreedModel = sequelize.define('VisitProductNotAgreed', {
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
    tableName: 'visit_products_not_agreed',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['visit_id', 'product_id']
      }
    ]
  });

  return VisitProductNotAgreedModel;
};

module.exports = VisitProductNotAgreed;