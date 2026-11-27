import { sequelize, DataTypes } from '../config/database.js';

const Country = sequelize.define('Country', {
  code: { type: DataTypes.STRING, allowNull: false, validate: { len: [2, 2] }, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
});

export default Country;
