import { sequelize, DataTypes } from '../config/database.js';

const TariffDutyComponent = sequelize.define('TariffDutyComponent', {
  hsnCode: { type: DataTypes.STRING, allowNull: false },
  dutyCategory: { type: DataTypes.STRING },
  calculationFlag: { type: DataTypes.STRING },
  rate: { type: DataTypes.REAL },
  amount: { type: DataTypes.REAL },
  uqc: { type: DataTypes.STRING },
});

export default TariffDutyComponent;
