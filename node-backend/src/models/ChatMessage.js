import { sequelize, DataTypes } from '../config/database.js';

// Chat history of the EagleView AI assistant (one row per message, per user).

const ChatMessage = sequelize.define(
  'ChatMessage',
  {
    userId: { type: DataTypes.STRING, allowNull: true },
    username: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.STRING, allowNull: false }, // 'user' | 'bot'
    text: { type: DataTypes.TEXT, allowNull: false },
    intent: { type: DataTypes.STRING, allowNull: true }, // what the bot understood (job, be, summary, tariff, rate, ai, help ...)
    data: { type: DataTypes.TEXT, allowNull: true }, // JSON: links / rows shown with the answer
    page: { type: DataTypes.STRING, allowNull: true }, // screen the user was on
  },
  { indexes: [{ fields: ['userId', 'createdAt'] }] },
);

export default ChatMessage;
