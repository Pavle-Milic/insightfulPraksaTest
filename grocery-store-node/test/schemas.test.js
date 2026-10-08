import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEmployeeSchema, loginSchema, parseBody, updateEmployeeSchema } from '../src/dto/schemas.js';
import { HttpError } from '../src/utils/httpError.js';

const validPerson = {
  name: 'Ana Anic',
  username: 'ana.anic',
  password: 'secret-pass-1',
  role: 'EMPLOYEE',
  nodeId: '000000000000000000000001',
};

function assertBadRequest(schema, body, expectedField) {
  assert.throws(
    () => parseBody(schema, body),
    (error) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 400);
      assert.match(error.message, new RegExp(expectedField));
      return true;
    },
  );
}

describe('request validation', () => {
  it('accepts a valid login body', () => {
    assert.deepEqual(parseBody(loginSchema, { username: 'a', password: 'b' }), { username: 'a', password: 'b' });
  });

  it('rejects a login body with missing or blank fields (400)', () => {
    assertBadRequest(loginSchema, { username: 'a' }, 'password');
    assertBadRequest(loginSchema, { username: '   ', password: 'b' }, 'username');
    assertBadRequest(loginSchema, undefined, 'body');
  });

  it('rejects values that are not strings, so nobody can send { "$ne": null } as a username', () => {
    assertBadRequest(loginSchema, { username: { $ne: null }, password: 'x' }, 'username');
  });

  it('accepts a valid create body and trims the text fields', () => {
    const result = parseBody(createEmployeeSchema, { ...validPerson, name: '  Ana Anic  ' });
    assert.equal(result.name, 'Ana Anic');
  });

  it('rejects a short password, a blank name and an unknown role on create (400)', () => {
    assertBadRequest(createEmployeeSchema, { ...validPerson, password: 'short' }, 'password');
    assertBadRequest(createEmployeeSchema, { ...validPerson, name: ' ' }, 'name');
    assertBadRequest(createEmployeeSchema, { ...validPerson, role: 'BOSS' }, 'role');
    assertBadRequest(createEmployeeSchema, { ...validPerson, password: undefined }, 'password');
  });

  it('on update the password is optional (missing or null), but at least 8 characters when sent', () => {
    const { password, ...withoutPassword } = validPerson;
    assert.doesNotThrow(() => parseBody(updateEmployeeSchema, withoutPassword));
    assert.doesNotThrow(() => parseBody(updateEmployeeSchema, { ...validPerson, password: null }));
    assertBadRequest(updateEmployeeSchema, { ...validPerson, password: 'short' }, 'password');
  });

  it('ignores fields that are not part of the contract (e.g. a client-supplied id)', () => {
    const result = parseBody(updateEmployeeSchema, { ...validPerson, id: 'hacked', isAdmin: true });
    assert.equal('id' in result, false);
    assert.equal('isAdmin' in result, false);
  });
});
