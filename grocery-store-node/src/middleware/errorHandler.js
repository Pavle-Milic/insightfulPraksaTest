import { STATUS_CODES } from 'node:http';

import { HttpError } from '../utils/httpError.js';

/** Any request that no route has answered. */
export function notFoundHandler(req, res, next) {
  next(new HttpError(404, 'Not found'));
}

/**
 * The one place where errors become HTTP responses. Express recognises it as an error handler
 * because it has four parameters. The body looks like Spring Boot's default error response.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = 500;
  let message = 'Internal server error';

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (err.expose && err.status >= 400 && err.status < 500) {
    // other client errors raised by Express itself (e.g. body too large)
    status = err.status;
    message = err.message;
  } else {
    // A real bug or an unexpected failure: log it, but don't leak details to the client
    console.error(err);
  }

  res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    error: STATUS_CODES[status],
    message,
    path: req.originalUrl,
  });
}
