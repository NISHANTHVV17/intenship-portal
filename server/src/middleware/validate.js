import { badRequest } from '../utils/http.js';

/**
 * Validates req[source] with a zod schema. Parsed body replaces req.body;
 * parsed query/params are exposed on req.valid.query / req.valid.params
 * (Express 5 makes req.query read-only).
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      throw badRequest(details[0]?.message || 'Validation failed', details);
    }
    req.valid = { ...req.valid, [source]: result.data };
    if (source === 'body') req.body = result.data;
    next();
  };
