import { Op } from 'sequelize';
import { ChatMessage } from '../../../models/index.js';
import { BadRequestError } from '../../../core/http/index.js';
import { allowedFor } from '../../../middlewares/branchScope.middleware.js';
import { HELP, INTENTS, branchScopeStore, geminiAnswer } from './chatbot.intents.js';

const DEFAULT_HISTORY_LIMIT = 60;
const MAX_HISTORY_LIMIT = 200;
const HISTORY_FOR_GEMINI = 10;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_LENGTH = 120;
const DEFAULT_BRANCH = 'DEL';

// the chat table is made on first use
let tableReady = null;
const ensureChatTable = () => {
  tableReady =
    tableReady ||
    ChatMessage.sync().catch((error) => {
      tableReady = null;
      throw error;
    });
  return tableReady;
};

const chatUserId = (user) => String((user && (user.id || user.username)) || 'anon');
const chatUserName = (user) => String((user && user.username) || '');

const messageAnswer = (message) => ({
  id: message.id,
  role: message.role,
  text: message.text,
  intent: message.intent,
  createdAt: message.createdAt,
});

/** The answer to a chat question: the first database intent that matches, else Gemini, else the help text. */
export async function answer(text, history) {
  for (const intent of INTENTS) {
    if (!intent.test(text)) continue;
    try {
      const reply = await intent.run(text);
      if (reply) return { ...reply, intent: intent.name };
    } catch (error) {
      console.warn('[chatbot]', intent.name, error.message);
      return {
        text: 'Sorry, I could not read that from the database just now. Please try again.',
        intent: intent.name + ':error',
      };
    }
  }
  try {
    const aiText = await geminiAnswer(history, text);
    if (aiText) return { text: aiText, intent: 'ai' };
  } catch (error) {
    console.warn('[chatbot] gemini:', error.message);
  }
  return { text: `I did not understand that yet.\n${HELP}`, intent: 'unknown' };
}

/** GET /history?limit&before: this user's saved chat, oldest first. */
export async function chatHistory(user, query) {
  await ensureChatTable();
  const limit = Math.min(MAX_HISTORY_LIMIT, parseInt(query.limit, 10) || DEFAULT_HISTORY_LIMIT);
  const where = { userId: chatUserId(user) };
  if (query.before) where.id = { [Op.lt]: parseInt(query.before, 10) };
  const messages = await ChatMessage.findAll({ where, order: [['id', 'DESC']], limit });
  return { success: true, data: messages.reverse().map(messageAnswer), more: messages.length === limit };
}

/** The branches the user may see (null = all) and the default branch a job without one counts as. */
async function branchScopeOf(user) {
  const branches = await allowedFor(user);
  const defaultBranch = branches ? ((await allowedFor(null)) || [DEFAULT_BRANCH])[0] : DEFAULT_BRANCH;
  return { branches, def: defaultBranch };
}

/** POST /message { text, page }: saves the question, answers it (from the user's branches only), saves the answer. */
export async function sendChatMessage(user, request) {
  await ensureChatTable();
  const text = String((request && request.text) || '')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
  if (!text) throw new BadRequestError('Empty message');
  const page = String((request && request.page) || '').slice(0, MAX_PAGE_LENGTH);
  const userId = chatUserId(user);
  const history = (
    await ChatMessage.findAll({ where: { userId }, order: [['id', 'DESC']], limit: HISTORY_FOR_GEMINI })
  ).reverse();
  const question = await ChatMessage.create({ userId, username: chatUserName(user), role: 'user', text, page });
  const scope = await branchScopeOf(user);
  const reply = await branchScopeStore.run(scope, () => answer(text, history));
  const botMessage = await ChatMessage.create({
    userId,
    username: chatUserName(user),
    role: 'bot',
    text: reply.text,
    intent: reply.intent,
    page,
  });
  return { success: true, data: [question, botMessage].map(messageAnswer) };
}

/** DELETE /history: clears this user's chat. */
export async function clearChatHistory(user) {
  await ensureChatTable();
  const deleted = await ChatMessage.destroy({ where: { userId: chatUserId(user) } });
  return { success: true, deleted };
}
