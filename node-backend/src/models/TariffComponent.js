import { sequelize, DataTypes } from '../config/database.js';

const TariffComponent = sequelize.define('TariffComponent', {
  dutyCategory: { type: DataTypes.STRING, allowNull: false },
  calculationFlag: { type: DataTypes.STRING, allowNull: false },
  rate: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  uqc: { type: DataTypes.STRING, allowNull: true },
});

export default TariffComponent;
