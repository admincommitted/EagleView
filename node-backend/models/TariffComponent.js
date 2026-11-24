const { sequelize, DataTypes } = require('../db');
const TariffHeader = require('./TariffHeader');

const TariffComponent = sequelize.define('TariffComponent', {
    dutyCategory: { type: DataTypes.STRING, allowNull: false },
    calculationFlag: { type: DataTypes.STRING, allowNull: false },
    rate: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    uqc: { type: DataTypes.STRING, allowNull: true }
});

TariffHeader.hasMany(TariffComponent, { as: 'components', foreignKey: 'tariffHeaderId', onDelete: 'CASCADE' });
TariffComponent.belongsTo(TariffHeader, { foreignKey: 'tariffHeaderId' });

module.exports = TariffComponent;
