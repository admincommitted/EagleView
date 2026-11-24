// Chat history of the EagleView AI assistant (one row per message, per user). Added 28-Oct-2026.
const { sequelize, DataTypes } = require('../db');

const ChatMessage = sequelize.define('ChatMessage', {
  userId:    { type: DataTypes.STRING, allowNull: true },
  username:  { type: DataTypes.STRING, allowNull: true },
  role:      { type: DataTypes.STRING, allowNull: false },   // 'user' | 'bot'
  text:      { type: DataTypes.TEXT, allowNull: false },
  intent:    { type: DataTypes.STRING, allowNull: true },    // what the bot understood (job, be, summary, tariff, rate, ai, help ...)
  data:      { type: DataTypes.TEXT, allowNull: true },      // JSON: links / rows shown with the answer
  page:      { type: DataTypes.STRING, allowNull: true },    // screen the user was on
}, { indexes: [{ fields: ['userId', 'createdAt'] }] });

module.exports = ChatMessage;
