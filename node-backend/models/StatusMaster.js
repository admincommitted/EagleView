const { sequelize, DataTypes } = require('../db');

// Job status codes shown in Status Master (MDM) and the Timeline drawer.
const StatusMaster = sequelize.define('StatusMaster', {
    code:        { type: DataTypes.STRING(50), allowNull: false, unique: true },
    description: { type: DataTypes.STRING },
    macroBucket: { type: DataTypes.STRING(30) },
    colorCode:   { type: DataTypes.STRING(20) },
    textColor:   { type: DataTypes.STRING(20) },
    module:      { type: DataTypes.STRING(20), defaultValue: 'IMPORT' },
    sequence:    { type: DataTypes.INTEGER, defaultValue: 0 },
    disables:    { type: DataTypes.TEXT },
    enables:     { type: DataTypes.TEXT },
    bubbleStyle: { type: DataTypes.STRING(30), defaultValue: 'LEFT_BORDER' }
}, { tableName: 'status_master' });

module.exports = StatusMaster;
