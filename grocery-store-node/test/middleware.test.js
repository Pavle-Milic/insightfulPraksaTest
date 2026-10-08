import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler.js';
import { createAuthMiddleware } from '../src/middleware/authMiddleware.js';
import { HttpError } from '../src/utils/httpError.js';
import { assertHttpError, createWorld } from './helpers/fakes.js';

// Middleware are plain functions (req, res, next), so we can call them with hand-made objects.

const fakeRequest = (authorization) => ({
  get: (header) => (header.toLowerCase() === 'authorization' ? authorization : undefined),
  originalUrl: '/api/test',
});

function fakeResponse() {
  return {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('authMiddleware', () => {
  // verify() accepts only "good-token" and returns the payload of srbija.manager1
  const jwtService = {
    verify(token) {
      if (token !== 'good-token') {
        throw new Error('jwt malformed');
      }
      return { sub: 'srbija.manager1' };
    },
  };

  async function setup() {
    const w = await createWorld();
    const authenticate = createAuthMiddleware({ jwtService, accessService: w.accessService });
    return { w, authenticate };
  }

  it('loads the user behind a valid token into req.user and calls next()', async () => {
    const { authenticate } = await setup();
    const req = fakeRequest('Bearer good-token');
    const next = mock.fn();

    await authenticate(req, fakeResponse(), next);

    assert.equal(next.mock.callCount(), 1);
    assert.equal(req.user.username, 'srbija.manager1');
  });

  it('rejects a missing Authorization header, or one that is not a Bearer token (401)', async () => {
    const { authenticate } = await setup();
    for (const header of [undefined, '', 'good-token', 'Basic abc123', 'Bearer']) {
      await assertHttpError(() => authenticate(fakeRequest(header), fakeResponse(), mock.fn()), 401);
    }
  });

  it('rejects a token that fails verification (tampered, expired, ...) with 401', async () => {
    const { authenticate } = await setup();
    await assertHttpError(
      () => authenticate(fakeRequest('Bearer bad-token'), fakeResponse(), mock.fn()),
      401,
      'Invalid or expired token',
    );
  });

  it('rejects a valid token of a user that has been deleted since (401)', async () => {
    const { w, authenticate } = await setup();
    const root = await w.user('srbija.manager1');
    await w.employeeRepository.deleteById(root.id);

    await assertHttpError(
      () => authenticate(fakeRequest('Bearer good-token'), fakeResponse(), mock.fn()),
      401,
      'User no longer exists',
    );
  });
});

describe('errorHandler', () => {
  it('turns an HttpError into a JSON response with its status and message', () => {
    const res = fakeResponse();
    errorHandler(new HttpError(403, 'Access denied to this node'), fakeRequest(), res, mock.fn());

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.status, 403);
    assert.equal(res.body.error, 'Forbidden');
    assert.equal(res.body.message, 'Access denied to this node');
    assert.equal(res.body.path, '/api/test');
    assert.ok(res.body.timestamp);
  });

  it('answers malformed JSON bodies with 400', () => {
    const res = fakeResponse();
    errorHandler(Object.assign(new SyntaxError('bad json'), { type: 'entity.parse.failed' }), fakeRequest(), res, mock.fn());
    assert.equal(res.statusCode, 400);
  });

  it('answers unexpected errors with a generic 500 and does not leak the details', () => {
    const consoleError = mock.method(console, 'error', () => {});
    const res = fakeResponse();

    errorHandler(new Error('connection string mongodb://secret'), fakeRequest(), res, mock.fn());

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Internal server error');
    assert.equal(consoleError.mock.callCount(), 1, 'the real error is logged on the server');
    consoleError.mock.restore();
  });

  it('hands the error over to Express when the response has already started', () => {
    const res = { ...fakeResponse(), headersSent: true };
    const next = mock.fn();
    const error = new Error('late failure');

    errorHandler(error, fakeRequest(), res, next);

    assert.equal(next.mock.callCount(), 1);
    assert.equal(next.mock.calls[0].arguments[0], error);
  });

  it('notFoundHandler forwards a 404 HttpError', () => {
    const next = mock.fn();
    notFoundHandler(fakeRequest(), fakeResponse(), next);

    const error = next.mock.calls[0].arguments[0];
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 404);
  });
});
