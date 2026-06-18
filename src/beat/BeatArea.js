const { DataTypes } = require('sequelize');

const BeatArea = (sequelize) => {
  return sequelize.define('BeatArea', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    beat_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'beats',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    area_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'areas',
        key: 'id'
      },
      onDelete: 'CASCADE'
    }
  }, {
    tableName: 'beat_areas',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['beat_id', 'area_id']
      }
    ]
  });
};

module.exports = BeatArea;
