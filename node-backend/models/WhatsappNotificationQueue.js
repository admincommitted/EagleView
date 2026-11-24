/**
 * WhatsappNotificationQueue.js
 * Stores pending WhatsApp status notifications to be sent in batch.
 */
const { sequelize, DataTypes } = require('../db');

const WhatsappNotificationQueue = sequelize.define('WhatsappNotificationQueue', {
  id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  partyName:    { type: DataTypes.STRING,  allowNull: true },
  mobileNumber: { type: DataTypes.STRING,  allowNull: false },
  awbNumber:    { type: DataTypes.STRING,  allowNull: true },
  statusText:   { type: DataTypes.TEXT,    allowNull: false },
  sent:         { type: DataTypes.BOOLEAN, defaultValue: false },
  sentAt:       { type: DataTypes.DATE,    allowNull: true },
  scheduledFor: { type: DataTypes.DATEONLY, allowNull: true }, // date it was queued for
  attempts:     { type: DataTypes.INTEGER, defaultValue: 0 },     // failed tries (28-Oct-2026: a failed send was marked sent and lost)
  lastError:    { type: DataTypes.STRING(500), allowNull: true },
}, {
  tableName: 'whatsapp_notification_queue',
  timestamps: true,
});

module.exports = WhatsappNotificationQueue;
