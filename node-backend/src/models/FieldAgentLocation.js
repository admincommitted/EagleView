import { sequelize, DataTypes } from '../config/database.js';

// Stores location history for each agent (ping every 5-10 seconds from mobile/app)
const FieldAgentLocation = sequelize.define(
  'FieldAgentLocation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    agentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lat: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    lng: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    accuracy: {
      type: DataTypes.FLOAT, // GPS accuracy in meters
    },
    speed: {
      type: DataTypes.FLOAT, // speed in km/h
    },
    heading: {
      type: DataTypes.FLOAT, // compass direction
    },
    battery: {
      type: DataTypes.INTEGER,
    },
    locationName: {
      type: DataTypes.STRING, // reverse geocoded name if available
    },
    recordedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'FieldAgentLocations',
    timestamps: false,
  },
);

export default FieldAgentLocation;
