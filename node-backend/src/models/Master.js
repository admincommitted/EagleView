import { sequelize, DataTypes } from '../config/database.js';

const MasterData = sequelize.define('MasterData', {
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  extraInfo: {
    type: DataTypes.JSON,
    allowNull: true,
  },
});

export default MasterData;
