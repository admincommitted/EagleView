const { sequelize } = require('../db');
const { awbColumns } = require('./awbColumns');

// Full column list restored 28-Oct-2026 — see models/awbColumns.js
const Airwaybill = sequelize.define('Airwaybill', { ...awbColumns });
module.exports = Airwaybill;
