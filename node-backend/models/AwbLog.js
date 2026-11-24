const { sequelize, DataTypes } = require('../db');

const AwbLog = sequelize.define('AwbLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    awbNumber: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    action: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    user: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'System'
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'awb_logs',
    timestamps: true
});

module.exports = AwbLog;
