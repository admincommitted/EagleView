import { sequelize } from '../config/database.js';
import { awbColumns } from './awbColumns.js';

const Airwaybill = sequelize.define('Airwaybill', { ...awbColumns });

export default Airwaybill;
