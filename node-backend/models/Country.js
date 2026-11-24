const { sequelize, DataTypes } = require('../db');

const Country = sequelize.define('Country', {
    code: { type: DataTypes.STRING, allowNull: false, validate: { len: [2, 2] }, unique: true },
    name: { type: DataTypes.STRING, allowNull: false }
});

module.exports = Country;