import { sequelize } from '../config/database.js';
import { awbColumns } from './awbColumns.js';

const MasterAWB = sequelize.define('MasterAWB', { ...awbColumns });

export default MasterAWB;
