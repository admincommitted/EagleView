import { ApiError, BadRequestError, asyncHandler } from '../../../core/http/index.js';

const UNIQUE_ERROR = 'SequelizeUniqueConstraintError';
const FOREIGN_KEY_ERROR = 'SequelizeForeignKeyConstraintError';

/**
 * Wraps a controller like asyncHandler, but an unexpected error (anything that is not an ApiError) is answered with the
 * status and body the master screens have always received for that route. errorHandler.middleware.js would answer
 * Sequelize unique / validation errors in its own shape, which these screens do not read.
 *   router.post('/', routeHandler(createPort, answerWithStatus(400)))
 */
export const routeHandler = (controller, errorAnswer = serverErrorAnswer) =>
  asyncHandler(async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const { status, body } = errorAnswer(error);
      throw new ApiError(status, error?.message, { body });
    }
  });

const messageOf = (error) => error.message;

const joinedMessages = (error) => (error.errors ? error.errors.map((item) => item.message).join(', ') : error.message);

export const answerWithStatus =
  (status, bodyOf = (error) => ({ error: messageOf(error) })) =>
  (error) => ({
    status,
    body: bodyOf(error),
  });

/** 500 { error } */
const serverErrorAnswer = answerWithStatus(500);

/** 500 { success: false, message } */
export const failedMessageAnswer = answerWithStatus(500, (error) => ({ success: false, message: messageOf(error) }));

/** 500 { success: false, error } */
export const failedErrorAnswer = answerWithStatus(500, (error) => ({ success: false, error: messageOf(error) }));

/** A failed save of a master record: duplicates and records in use are 409, other problems `defaultStatus`. */
export const recordErrorAnswer =
  (defaultStatus = 400) =>
  (error) => {
    if (error?.name === UNIQUE_ERROR) {
      const duplicates = (error.errors || []).map((item) => `${item.path} ${item.value}`).join(', ');
      return { status: 409, body: { error: `Already exists: ${duplicates}` } };
    }
    if (error?.name === FOREIGN_KEY_ERROR) {
      return { status: 409, body: { error: 'This record is used elsewhere and cannot be changed / deleted' } };
    }
    return { status: error.status || defaultStatus, body: { error: joinedMessages(error) } };
  };

/** Branch / financial year / CHA masters: { success: false, error } */
export const companyMasterErrorAnswer = (error) => {
  if (error?.name === UNIQUE_ERROR) return { status: 409, body: { success: false, error: 'This code already exists' } };
  return { status: error.status || 500, body: { success: false, error: error.message } };
};

/** A 400 in the { success: false, error } shape of the branch / financial year / CHA masters. */
export const companyMasterBadRequest = (message) =>
  new BadRequestError(message, { body: { success: false, error: message } });

/** 400 { error } with every Sequelize message joined. */
export const joinedMessagesAnswer = (status) => answerWithStatus(status, (error) => ({ error: joinedMessages(error) }));
