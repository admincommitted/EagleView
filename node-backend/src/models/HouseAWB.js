import { sequelize } from '../config/database.js';
import { awbColumns } from './awbColumns.js';

const HouseAWB = sequelize.define('HouseAWB', { ...awbColumns });

export default HouseAWB;
