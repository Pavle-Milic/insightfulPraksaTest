import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertHttpError, createWorld } from './helpers/fakes.js';

describe('AccessService', () => {
  it('subtreeNodeIds returns the node and all its descendants', async () => {
    const w = await createWorld();
    const ids = await w.accessService.subtreeNodeIds(w.node('Novi Beograd').id);
    assert.deepEqual(w.namesOf(ids), ['Bezanija', 'Novi Beograd', 'Radnja 6']);
  });

  it('a leaf node (a store) only contains itself', async () => {
    const w = await createWorld();
    const ids = await w.accessService.subtreeNodeIds(w.node('Radnja 6').id);
    assert.deepEqual(w.namesOf(ids), ['Radnja 6']);
  });

  it('the root can access all 23 nodes', async () => {
    const w = await createWorld();
    const root = await w.user('srbija.manager1');
    const ids = await w.accessService.accessibleNodeIds(root);
    assert.equal(ids.size, 23);
  });

  it('a manager can access own node and descendants, but not the parent or other branches', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const can = (name) => w.accessService.canAccessNode(manager, w.node(name).id);

    assert.equal(await can('Novi Beograd'), true);
    assert.equal(await can('Bezanija'), true);
    assert.equal(await can('Radnja 6'), true);
    assert.equal(await can('Grad Beograd'), false); // parent
    assert.equal(await can('Vracar'), false); // sibling branch
    assert.equal(await can('Radnja 7'), false);
    assert.equal(await can('Vojvodina'), false); // other part of the country
  });

  it('an employee has the same node scope as a manager of the same node', async () => {
    const w = await createWorld();
    const employee = await w.user('novibeograd.employee1');
    const ids = await w.accessService.accessibleNodeIds(employee);
    assert.deepEqual(w.namesOf(ids), ['Bezanija', 'Novi Beograd', 'Radnja 6']);
  });

  it('requireAccessToNode throws 403 for a node outside the scope', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    await assertHttpError(
      () => w.accessService.requireAccessToNode(manager, w.node('Vracar').id),
      403,
      'Access denied to this node',
    );
    await w.accessService.requireAccessToNode(manager, w.node('Radnja 6').id); // does not throw
  });

  it('requireManager lets managers through and rejects employees with 403', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const employee = await w.user('novibeograd.employee1');

    w.accessService.requireManager(manager); // does not throw
    await assertHttpError(
      () => w.accessService.requireManager(employee),
      403,
      'Only managers can modify employees',
    );
    await assertHttpError(
      () => w.accessService.requireManager(employee, 'view managers'),
      403,
      'Only managers can view managers',
    );
  });

  it('requireAccessToEmployee throws 403 for a person in another branch', async () => {
    const w = await createWorld();
    const manager = await w.user('novibeograd.manager1');
    const inScope = await w.user('radnja6.employee1');
    const outOfScope = await w.user('radnja7.employee1');

    await w.accessService.requireAccessToEmployee(manager, inScope); // does not throw
    await assertHttpError(
      () => w.accessService.requireAccessToEmployee(manager, outOfScope),
      403,
      'Access denied to this employee',
    );
  });

  it('currentUser loads the user by username and throws 401 when they no longer exist', async () => {
    const w = await createWorld();
    const user = await w.accessService.currentUser('novisad.manager1');
    assert.equal(user.name, 'Novi Sad manager1');
    await assertHttpError(() => w.accessService.currentUser('nobody'), 401, 'User no longer exists');
  });
});
