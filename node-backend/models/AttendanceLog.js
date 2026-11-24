const { sequelize, DataTypes } = require('../db');

const AttendanceLog = sequelize.define('AttendanceLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    employeeId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    punchIn: {
        type: DataTypes.TIME
    },
    punchOut: {
        type: DataTypes.TIME
    },
    status: {
        type: DataTypes.ENUM('P', 'A', 'L', 'WO', 'HD'),
        defaultValue: 'A'
    },
    isLateMark: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    punchInLocation: {
        type: DataTypes.STRING
    },
    punchOutLocation: {
        type: DataTypes.STRING
    },
    punchInPhotoUrl: {
        type: DataTypes.STRING
    },
    punchOutPhotoUrl: {
        type: DataTypes.STRING
    },
    allPunches: {
        type: DataTypes.JSON
    }
});

module.exports = AttendanceLog;
