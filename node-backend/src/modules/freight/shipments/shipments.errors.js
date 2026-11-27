import { BadRequestError, NotFoundError } from '../../../core/http/index.js';

/** The Shipment Registration screens read { error } answers. */
export const badRequest = (message) => new BadRequestError(message, { body: { error: message } });
export const notFound = (message) => new NotFoundError(message, { body: { error: message } });
export const docketNotFound = () => notFound('Docket not found');
