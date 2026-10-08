import { HttpError } from '../utils/httpError.js';

/**
 * Runs before every protected route (the equivalent of Spring Security's filter chain):
 * checks the "Authorization: Bearer <token>" header, then loads the user behind the token
 * and puts it on req.user for the controllers to use.
 */
export function createAuthMiddleware({ jwtService, accessService }) {
  return async function authenticate(req, res, next) {
    const [scheme, token] = (req.get('Authorization') ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new HttpError(401, 'Missing or malformed Authorization header');
    }

    let payload;
    try {
      payload = jwtService.verify(token);
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }

    req.user = await accessService.currentUser(payload.sub);
    next();
  };
}
