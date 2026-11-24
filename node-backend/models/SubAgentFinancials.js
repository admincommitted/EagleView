const { sequelize, DataTypes } = require('../db');

const SubAgentFinancials = sequelize.define('SubAgentFinancials', {
    partyId: { type: DataTypes.INTEGER, allowNull: false, unique: true }, // 1-to-1 extension of Party
    panNumber: { type: DataTypes.STRING, allowNull: false, validate: { len: [10, 10] } },
    incentivePayable: { type: DataTypes.REAL, defaultValue: 0.0 },
    commissionPayable: { type: DataTypes.REAL, defaultValue: 0.0 }
    // Strictly NO credit limit fields
});

module.exports = SubAgentFinancials;
