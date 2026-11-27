import { sequelize, DataTypes } from '../config/database.js';

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'operator',
  },
  fullName: {
    type: DataTypes.STRING,
  },
  contactNumber: {
    type: DataTypes.STRING,
  },
  designation: {
    type: DataTypes.STRING,
  },
  department: {
    type: DataTypes.STRING,
  },
  branch: {
    type: DataTypes.STRING,
  },
  reportingTo1: {
    type: DataTypes.STRING,
  },
  reportingTo2: {
    type: DataTypes.STRING,
  },
  limitMin: {
    type: DataTypes.STRING,
  },
  limitMax: {
    type: DataTypes.STRING,
  },
  sessionTimeout: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
  },
  allowStatusUpdates: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
  },
  // one-time password reset link; only a hash of the token is stored
  resetTokenHash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetTokenExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default User;
