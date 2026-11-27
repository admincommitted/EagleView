import { sequelize, DataTypes } from '../config/database.js';

const EmployeeMaster = sequelize.define('EmployeeMaster', {
  employeeId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
  },
  department: {
    type: DataTypes.STRING,
  },
  designation: {
    type: DataTypes.STRING,
  },
  dateOfJoining: {
    type: DataTypes.DATEONLY,
  },
  email: {
    type: DataTypes.STRING,
  },
  phone: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active',
  },
});

export default EmployeeMaster;
