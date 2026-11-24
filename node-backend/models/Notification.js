const { sequelize, DataTypes } = require('../db');

const Notification = sequelize.define('Notification', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true // If null, it's a global notification (optional feature)
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'info' // e.g. info, success, warning, error
  },
  // 28-Oct-2026: who sent it (user name / SYSTEM) and an optional screen to open (e.g. /import?job=12)
  sentBy: { type: DataTypes.STRING, allowNull: true },
  link: { type: DataTypes.STRING, allowNull: true }
});

// read / hidden state of a broadcast (userId null) for each user: one row per user who read or removed it. 28-Oct-2026
const NotificationRead = sequelize.define('NotificationRead', {
  notificationId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  hidden: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { indexes: [{ unique: true, fields: ['notificationId', 'userId'] }] });

module.exports = Notification;
module.exports.NotificationRead = NotificationRead;
