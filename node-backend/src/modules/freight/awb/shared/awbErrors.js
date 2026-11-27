import { BadRequestError, ConflictError, NotFoundError } from '../../../../core/http/index.js';

/** The AWB screens read { error, ...extra } answers: the body is sent exactly as given. */
const answerWith = (ErrorClass) => (body) => new ErrorClass(body.error, { body });

export const badRequest = answerWith(BadRequestError);
export const notFound = answerWith(NotFoundError);
export const conflict = answerWith(ConflictError);

export const awbNotFound = () => notFound({ error: 'AWB not found' });
