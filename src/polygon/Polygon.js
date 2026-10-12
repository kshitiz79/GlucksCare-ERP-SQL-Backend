const { DataTypes } = require('sequelize');

const Polygon = (sequelize) => {
  return sequelize.define('Polygon', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    pincode: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    office_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    division: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    region: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    circle: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    district: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'Bihar'
    },
    head_office_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'head_offices',
        key: 'id'
      }
    },
    latitude: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0
    },
    longitude: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0
    },
    geometry: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    coordinates: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    properties: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'polygon',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['pincode']
      },
      {
        fields: ['head_office_id']
      },
      {
        fields: ['district']
      },
      {
        fields: ['division']
      },
      {
        fields: ['state']
      }
    ]
  });
};

module.exports = Polygon;
