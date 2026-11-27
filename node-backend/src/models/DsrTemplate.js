import { sequelize, DataTypes } from '../config/database.js';

// DSR report templates. Columns, colour rules, schedule etc. are kept as JSON in `config`.
const DsrTemplate = sequelize.define(
  'DsrTemplate',
  {
    name: { type: DataTypes.STRING, allowNull: false },
    module: { type: DataTypes.STRING(20), defaultValue: 'IMPORT' },
    client: { type: DataTypes.STRING, defaultValue: 'ALL' },
    clientRole: { type: DataTypes.STRING(30) },
    config: { type: DataTypes.TEXT },
  },
  { tableName: 'dsr_templates' },
);

export default DsrTemplate;
