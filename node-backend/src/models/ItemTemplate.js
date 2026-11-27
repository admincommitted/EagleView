import { sequelize, DataTypes } from '../config/database.js';

const ItemTemplate = sequelize.define('ItemTemplate', {
  templateName: { type: DataTypes.STRING, allowNull: false },
  jobType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'BE' },
  jsonPayload: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.STRING, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true }, // switch off instead of delete (column added at start by ensureColumns)
});

export default ItemTemplate;
