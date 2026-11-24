const { sequelize, DataTypes } = require('../db');

const UserPermission = sequelize.define('UserPermission', {
  moduleName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  canView: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  canCreate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  canEdit: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  canDelete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

module.exports = UserPermission;
