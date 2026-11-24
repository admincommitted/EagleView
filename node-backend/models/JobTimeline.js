const { sequelize, DataTypes } = require('../db');

// Remarks / status events per job (Timeline drawer). Also searched by /api/search/global-search.
const JobTimeline = sequelize.define('JobTimeline', {
    jobId:     { type: DataTypes.STRING(50), allowNull: false },
    module:    { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'IMPORT' },
    eventType: { type: DataTypes.STRING(30), defaultValue: 'REMARK' },
    message:   { type: DataTypes.TEXT },
    author:    { type: DataTypes.STRING(100) }
}, { tableName: 'job_timeline', indexes: [{ fields: ['module', 'jobId'] }] });

module.exports = JobTimeline;
