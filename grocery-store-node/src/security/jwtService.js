import jwt from 'jsonwebtoken';

/** Signs (HS256) and validates the JWTs issued by the login endpoint. */
export function createJwtService({ secret, expirationMinutes }) {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT secret must be at least 32 characters long (HS256 needs 256 bits)');
  }

  return {
    /** The token only carries the username (the "sub" claim). */
    sign(subject) {
      const expiresAt = new Date(Date.now() + expirationMinutes * 60_000);
      const token = jwt.sign(
        { sub: subject, exp: Math.floor(expiresAt.getTime() / 1000) },
        secret,
        { algorithm: 'HS256' },
      );
      return { token, expiresAt };
    },

    /** Returns the payload, or throws when the token is malformed, tampered with or expired. */
    verify(token) {
      return jwt.verify(token, secret, { algorithms: ['HS256'] });
    },
  };
}
