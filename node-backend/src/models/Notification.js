import { sequelize, DataTypes } from '../config/database.js';

const Notification = sequelize.define('Notification', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // If null, it's a global notification (optional feature)
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'info', // e.g. info, success, warning, error
  },
  // who sent it (user name / SYSTEM) and an optional screen to open (e.g. /import?job=12)
  sentBy: { type: DataTypes.STRING, allowNull: true },
  link: { type: DataTypes.STRING, allowNull: true },
});

// read / hidden state of a broadcast (userId null) for each user: one row per user who read or removed it.
const NotificationRead = sequelize.define(
  'NotificationRead',
  {
    notificationId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    hidden: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { indexes: [{ unique: true, fields: ['notificationId', 'userId'] }] },
);

// routes read the per-user table as Notification.NotificationRead
Notification.NotificationRead = NotificationRead;

export { NotificationRead };

export default Notification;
