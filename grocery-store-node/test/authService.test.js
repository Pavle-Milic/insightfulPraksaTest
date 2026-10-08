import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertHttpError, createWorld } from './helpers/fakes.js';

describe('AuthService.login', () => {
  it('returns a bearer token, its expiry and the user info (without the password)', async () => {
    const w = await createWorld();
    const response = await w.authService.login({ username: 'srbija.manager1', password: 'password123' });

    assert.equal(response.token, 'token-for-srbija.manager1');
    assert.equal(response.tokenType, 'Bearer');
    assert.equal(response.expiresAt, '2030-01-01T00:00:00.000Z');
    assert.equal(response.user.username, 'srbija.manager1');
    assert.equal(response.user.role, 'MANAGER');
    assert.equal(response.user.nodeId, w.node('Srbija').id);
    assert.equal('password' in response.user, false);
  });

  it('rejects a wrong password with 401', async () => {
    const w = await createWorld();
    await assertHttpError(
      () => w.authService.login({ username: 'srbija.manager1', password: 'wrong-password' }),
      401,
      'Invalid username or password',
    );
  });

  it('rejects an unknown username with the very same 401 (does not reveal which usernames exist)', async () => {
    const w = await createWorld();
    await assertHttpError(
      () => w.authService.login({ username: 'nobody', password: 'password123' }),
      401,
      'Invalid username or password',
    );
  });
});
