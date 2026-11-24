const { sequelize, DataTypes } = require('../db');

const Vessel = sequelize.define('Vessel', {
    vesselName: { type: DataTypes.STRING, allowNull: false },
    imoNumber: { type: DataTypes.STRING, allowNull: false },
    callSign: { type: DataTypes.STRING, allowNull: true },
    carrierAgent: { type: DataTypes.STRING, allowNull: true },
    // 28-Oct-2026: the logo picked on the Vessel screen had no column, so it was lost on save (added by ensureColumns)
    customLogo: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true } // 22-Nov-2026: switch off instead of delete (column added at start by ensureColumns)
});

module.exports = Vessel;
