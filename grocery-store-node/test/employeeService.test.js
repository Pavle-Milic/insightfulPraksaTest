import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DuplicateKeyError } from '../src/repositories/errors.js';
import { assertHttpError, createWorld, usernames } from './helpers/fakes.js';

describe('EmployeeService - listing', () => {
  it('lists the employees (not the managers) that belong directly to a node', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');

    const result = await w.employeeService.findEmployeesInNode(manager, w.node('Novi Beograd').id);

    assert.deepEqual(usernames(result), ['novibeograd.employee1', 'novibeograd.employee2']);
    assert.ok(result.every((p) => p.role === 'EMPLOYEE'));
    assert.ok(result.every((p) => !('password' in p)), 'the password hash must never be returned');
  });

  it('lets a manager list a descendant node, but not a node outside the scope (403)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');

    const inScope = await w.employeeService.findEmployeesInNode(manager, w.node('Radnja 6').id);
    assert.deepEqual(usernames(inScope), ['radnja6.employee1', 'radnja6.employee2']);

    for (const outside of ['Vracar', 'Grad Beograd', 'Vojvodina']) {
      await assertHttpError(
        () => w.employeeService.findEmployeesInNode(manager, w.node(outside).id),
        403,
        'Access denied to this node',
      );
    }
  });

  it('lists the employees of a node AND all its descendants', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');

    const result = await w.employeeService.findEmployeesInNodeAndDescendants(manager, w.node('Novi Beograd').id);

    assert.deepEqual(usernames(result), [
      'bezanija.employee1',
      'bezanija.employee2',
      'novibeograd.employee1',
      'novibeograd.employee2',
      'radnja6.employee1',
      'radnja6.employee2',
    ]);
  });

  it('the root sees the employees of the whole company', async () => {
    const w = await createWorld();
    const root = await w.user('srbija.manager1');
    const result = await w.employeeService.findEmployeesInNodeAndDescendants(root, w.node('Srbija').id);
    assert.equal(result.length, 23 * 2);
  });

  it('refuses to list node + descendants for a node outside the scope (403)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    await assertHttpError(
      () => w.employeeService.findEmployeesInNodeAndDescendants(manager, w.node('Grad Beograd').id),
      403,
    );
  });

  it('an employee may see employees of own node and descendants', async () => {
    const w = await createWorld();
    const employee = await w.user('novibeograd.employee1');

    const own = await w.employeeService.findEmployeesInNode(employee, w.node('Novi Beograd').id);
    assert.equal(own.length, 2);

    const withDescendants = await w.employeeService.findEmployeesInNodeAndDescendants(
      employee,
      w.node('Novi Beograd').id,
    );
    assert.equal(withDescendants.length, 6);

    await assertHttpError(() => w.employeeService.findEmployeesInNode(employee, w.node('Vracar').id), 403);
  });

  it('lists the managers of a node, and of a node + all its descendants', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');

    const own = await w.employeeService.findManagersInNode(manager, w.node('Novi Beograd').id);
    assert.deepEqual(usernames(own), ['novibeograd.manager1']);
    assert.ok(own.every((p) => p.role === 'MANAGER'));

    const withDescendants = await w.employeeService.findManagersInNodeAndDescendants(
      manager,
      w.node('Novi Beograd').id,
    );
    assert.deepEqual(usernames(withDescendants), [
      'bezanija.manager1',
      'novibeograd.manager1',
      'radnja6.manager1',
    ]);
  });

  it('refuses to list managers outside the manager scope (403)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    await assertHttpError(() => w.employeeService.findManagersInNode(manager, w.node('Vracar').id), 403);
    await assertHttpError(
      () => w.employeeService.findManagersInNodeAndDescendants(manager, w.node('Grad Beograd').id),
      403,
    );
  });

  it('an employee may NOT see managers, not even in their own node (403)', async () => {
    const w = await createWorld();
    const employee = await w.user('novibeograd.employee1');
    const nodeId = w.node('Novi Beograd').id;

    await assertHttpError(
      () => w.employeeService.findManagersInNode(employee, nodeId),
      403,
      'Only managers can view managers',
    );
    await assertHttpError(
      () => w.employeeService.findManagersInNodeAndDescendants(employee, nodeId),
      403,
      'Only managers can view managers',
    );
  });
});

describe('EmployeeService - findById', () => {
  it('returns a person from the caller scope', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    const result = await w.employeeService.findById(manager, target.id);
    assert.equal(result.username, 'radnja6.employee1');
    assert.equal('password' in result, false);
  });

  it('refuses a person from another branch (403) and an unknown id (404)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const outsider = await w.user('radnja7.employee1');

    await assertHttpError(() => w.employeeService.findById(manager, outsider.id), 403);
    await assertHttpError(() => w.employeeService.findById(manager, 'f'.repeat(24)), 404, 'Employee not found');
  });

  it('an employee can see another employee in scope, but not a manager', async () => {
    const w = await createWorld();
    const employee = await w.user('novibeograd.employee1');
    const colleague = await w.user('bezanija.employee1');
    const boss = await w.user('novibeograd.manager1');

    const result = await w.employeeService.findById(employee, colleague.id);
    assert.equal(result.username, 'bezanija.employee1');
    await assertHttpError(() => w.employeeService.findById(employee, boss.id), 403);
  });
});

describe('EmployeeService - create', () => {
  const newPerson = (w, overrides = {}) => ({
    name: 'Ana Anic',
    username: 'ana.anic',
    password: 'secret-pass-1',
    role: 'EMPLOYEE',
    nodeId: w.node('Bezanija').id,
    ...overrides,
  });

  it('lets a manager create an employee in a descendant node; the password is stored hashed', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');

    const created = await w.employeeService.create(manager, newPerson(w));

    assert.ok(created.id);
    assert.equal(created.username, 'ana.anic');
    assert.equal(created.role, 'EMPLOYEE');
    assert.equal(created.nodeId, w.node('Bezanija').id);
    assert.equal('password' in created, false);

    const stored = await w.employeeRepository.findByUsername('ana.anic');
    assert.equal(stored.password, 'hash(secret-pass-1)');
    assert.notEqual(stored.password, 'secret-pass-1');

    const inBezanija = await w.employeeService.findEmployeesInNode(manager, w.node('Bezanija').id);
    assert.ok(usernames(inBezanija).includes('ana.anic'));
  });

  it('lets a manager create another manager', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');

    await w.employeeService.create(manager, newPerson(w, { username: 'new.boss', role: 'MANAGER' }));

    const managers = await w.employeeService.findManagersInNode(manager, w.node('Bezanija').id);
    assert.ok(usernames(managers).includes('new.boss'));
  });

  it('refuses employees (403)', async () => {
    const w = await createWorld();
    const employee = await w.user('novibeograd.employee1');
    await assertHttpError(() => w.employeeService.create(employee, newPerson(w)), 403, 'Only managers can modify employees');
  });

  it('refuses to create a person in a node outside the manager scope (403)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    await assertHttpError(
      () => w.employeeService.create(manager, newPerson(w, { nodeId: w.node('Vracar').id })),
      403,
      'Access denied to this node',
    );
  });

  it('refuses a taken username (409) and a malformed nodeId (400)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');

    await assertHttpError(
      () => w.employeeService.create(manager, newPerson(w, { username: 'bezanija.employee1' })),
      409,
      'Username already taken',
    );
    await assertHttpError(
      () => w.employeeService.create(manager, newPerson(w, { nodeId: 'not-an-id' })),
      400,
      'Invalid nodeId',
    );
  });
});

describe('EmployeeService - update', () => {
  const changes = (w, overrides = {}) => ({
    name: 'Renamed Person',
    username: 'renamed.person',
    password: undefined,
    role: 'EMPLOYEE',
    nodeId: w.node('Radnja 6').id,
    ...overrides,
  });

  it('replaces name, username, role and node; the password stays when none is sent', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    const result = await w.employeeService.update(manager, target.id, changes(w));

    assert.equal(result.name, 'Renamed Person');
    assert.equal(result.username, 'renamed.person');
    const stored = await w.employeeRepository.findById(target.id);
    assert.equal(stored.password, target.password);
  });

  it('keeps the password when the client sends null', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    await w.employeeService.update(manager, target.id, changes(w, { password: null }));

    assert.equal((await w.employeeRepository.findById(target.id)).password, target.password);
  });

  it('changes the password (hashed) when a new one is sent', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    await w.employeeService.update(manager, target.id, changes(w, { password: 'brand-new-pass' }));

    assert.equal((await w.employeeRepository.findById(target.id)).password, 'hash(brand-new-pass)');
  });

  it('can move a person to another node inside the scope, and promote them to manager', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    const result = await w.employeeService.update(
      manager,
      target.id,
      changes(w, { username: target.username, role: 'MANAGER', nodeId: w.node('Bezanija').id }),
    );

    assert.equal(result.role, 'MANAGER');
    assert.equal(result.nodeId, w.node('Bezanija').id);
  });

  it('refuses to move a person to a node outside the scope (403)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    await assertHttpError(
      () => w.employeeService.update(manager, target.id, changes(w, { nodeId: w.node('Vracar').id })),
      403,
      'Access denied to this node',
    );
  });

  it('refuses to update a person from another branch (403)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const outsider = await w.user('radnja7.employee1');

    await assertHttpError(() => w.employeeService.update(manager, outsider.id, changes(w)), 403, 'Access denied to this employee');
  });

  it('refuses employees (403) and unknown ids (404)', async () => {
    const w = await createWorld();
    const employee = await w.user('novibeograd.employee1');
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    await assertHttpError(() => w.employeeService.update(employee, target.id, changes(w)), 403);
    await assertHttpError(() => w.employeeService.update(manager, 'f'.repeat(24), changes(w)), 404, 'Employee not found');
  });

  it('refuses a username used by somebody else (409), but allows keeping your own', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    await assertHttpError(
      () => w.employeeService.update(manager, target.id, changes(w, { username: 'radnja6.employee2' })),
      409,
      'Username already taken',
    );
    await w.employeeService.update(manager, target.id, changes(w, { username: target.username })); // does not throw
  });

  it('turns a unique-index violation from the database into 409 (two requests racing)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');
    w.employeeRepository.save = async () => {
      throw new DuplicateKeyError();
    };

    await assertHttpError(() => w.employeeService.update(manager, target.id, changes(w)), 409, 'Username already taken');
  });
});

describe('EmployeeService - remove', () => {
  it('lets a manager delete a person from the scope', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const target = await w.user('radnja6.employee1');

    await w.employeeService.remove(manager, target.id);

    assert.equal(await w.employeeRepository.findById(target.id), null);
    await assertHttpError(() => w.employeeService.findById(manager, target.id), 404);
  });

  it('refuses employees (403), people from another branch (403) and unknown ids (404)', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const employee = await w.user('novibeograd.employee1');
    const inScope = await w.user('radnja6.employee1');
    const outsider = await w.user('radnja7.employee1');

    await assertHttpError(() => w.employeeService.remove(employee, inScope.id), 403);
    await assertHttpError(() => w.employeeService.remove(manager, outsider.id), 403);
    await assertHttpError(() => w.employeeService.remove(manager, 'f'.repeat(24)), 404);

    assert.ok(await w.employeeRepository.findById(inScope.id), 'nothing may have been deleted');
    assert.ok(await w.employeeRepository.findById(outsider.id), 'nothing may have been deleted');
  });
});
