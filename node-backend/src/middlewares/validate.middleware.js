import { ValidationError } from '../core/http/HttpError.js';

const PARTS = ['params', 'query', 'body'];

const issuesOf = (error) => error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));

/**
 * Checks req.params / req.query / req.body with Zod schemas from a module's <name>.validation.js before the controller.
 * The parsed (trimmed / coerced) values are on req.validated.<part>; req.body is also replaced by its parsed value.
 * The first problem's message is the error text, so a schema can give the same message the old route did.
 *   router.post('/', validate({ body: createPortSchema }), createPort)
 *   validate({ body }, { errorBody: (message) => ({ error: message }) })   // old answer shape { error }
 */
export const validate =
  (schemas, { errorBody } = {}) =>
  (req, res, next) => {
    req.validated = req.validated || {};
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const issues = issuesOf(result.error);
        const message = issues[0]?.message || 'Some fields are not valid';
        return next(
          new ValidationError(message, errorBody ? { body: errorBody(message, issues) } : { errors: issues }),
        );
      }
      req.validated[part] = result.data;
      if (part === 'body') req.body = result.data;
    }
    return next();
  };
