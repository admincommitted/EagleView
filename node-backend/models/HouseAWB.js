const { sequelize } = require('../db');
const { awbColumns } = require('./awbColumns');

// Full column list restored 28-Oct-2026 — see models/awbColumns.js
const HouseAWB = sequelize.define('HouseAWB', { ...awbColumns });
module.exports = HouseAWB;
