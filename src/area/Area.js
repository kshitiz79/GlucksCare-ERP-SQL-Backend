const { DataTypes } = require('sequelize');

const Area = (sequelize) => {
  return sequelize.define('Area', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    post_office: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    head_office_id: {
      type: DataTypes.UUID,
      allowNull: false,
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
    radius: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 300
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    colors: {
      type: DataTypes.VIRTUAL,
      get() {
        const beats = this.getDataValue('beats');
        return beats ? [...new Set(beats.map(b => b.color).filter(Boolean))] : [];
      }
    }
  }, {
    tableName: 'areas',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['pincode', 'name']
      }
    ]
  });
};

module.exports = Area;
