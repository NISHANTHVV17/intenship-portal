import { config } from '../config.js';
import { HttpError } from '../utils/http.js';

export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err?.code === 'ERR_SQLITE_ERROR' && /UNIQUE constraint failed/.test(err.message)) {
    return res.status(409).json({ error: 'A record with these details already exists' });
  }
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 && config.isProd ? 'Internal server error' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
