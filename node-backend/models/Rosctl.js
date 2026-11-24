const { sequelize, DataTypes } = require('../db');
const Rosctl = sequelize.define('Rosctl', {
    tariffItem: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    rate: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
    cap: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 }
    , uqc: { type: DataTypes.STRING, allowNull: true }
    , isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});
module.exports = Rosctl;
