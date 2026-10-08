import { toUserInfo } from '../dto/mappers.js';
import { HttpError } from '../utils/httpError.js';

export function createAuthService({ employeeRepository, passwordEncoder, jwtService }) {
  /** Checks the credentials and issues a token. */
  async function login({ username, password }) {
    const user = await employeeRepository.findByUsername(username);
    const passwordMatches = user ? await passwordEncoder.matches(password, user.password) : false;

    // Same error for "no such user" and "wrong password" so the API doesn't reveal which usernames exist
    if (!passwordMatches) {
      throw new HttpError(401, 'Invalid username or password');
    }

    const { token, expiresAt } = jwtService.sign(user.username);
    return {
      token,
      tokenType: 'Bearer',
      expiresAt: expiresAt.toISOString(),
      user: toUserInfo(user),
    };
  }

  return { login };
}
