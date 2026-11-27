import { sequelize, DataTypes } from '../config/database.js';

const UserProfile = sequelize.define('UserProfile', {
  firstName: DataTypes.STRING,
  lastName: DataTypes.STRING,
  phone: DataTypes.STRING,
  companyName: DataTypes.STRING,
  jobTitle: DataTypes.STRING,
  address: DataTypes.STRING,
});

export default UserProfile;
