const { sequelize, DataTypes } = require('../db');
const User = require('./User');

const UserProfile = sequelize.define('UserProfile', {
  firstName: DataTypes.STRING,
  lastName: DataTypes.STRING,
  phone: DataTypes.STRING,
  companyName: DataTypes.STRING,
  jobTitle: DataTypes.STRING,
  address: DataTypes.STRING
});

User.hasOne(UserProfile, { foreignKey: 'userId', as: 'profile' });
UserProfile.belongsTo(User, { foreignKey: 'userId' });

module.exports = UserProfile;
