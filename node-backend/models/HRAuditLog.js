const { sequelize, DataTypes } = require('../db');

const HRAuditLog = sequelize.define('HRAuditLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    actionType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    employeeId: {
        type: DataTypes.STRING
    },
    performedBy: {
        type: DataTypes.STRING
    },
    details: {
        type: DataTypes.JSON
    }
});

module.exports = HRAuditLog;
