const { DataTypes } = require('sequelize');

const createMasterModel = (sequelize, modelName, tableName) => {
    return sequelize.define(modelName, {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true
        }
    }, {
        tableName: tableName,
        timestamps: true,
        underscored: true
    });
};

const Salt = (sequelize) => createMasterModel(sequelize, 'Salt', 'master_salts');
const Unit = (sequelize) => createMasterModel(sequelize, 'Unit', 'master_units');
const StripSize = (sequelize) => createMasterModel(sequelize, 'StripSize', 'master_stripsizes');
const Hsn = (sequelize) => createMasterModel(sequelize, 'Hsn', 'master_hsns');
const Gst = (sequelize) => createMasterModel(sequelize, 'Gst', 'master_gsts');
const PackSize = (sequelize) => createMasterModel(sequelize, 'PackSize', 'master_packsizes');

module.exports = {
    Salt,
    Unit,
    StripSize,
    Hsn,
    Gst,
    PackSize
};
