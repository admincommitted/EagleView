import { sequelize, DataTypes } from '../config/database.js';

const UserPermission = sequelize.define('UserPermission', {
  moduleName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  canView: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  canCreate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  canEdit: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  canDelete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

export default UserPermission;
