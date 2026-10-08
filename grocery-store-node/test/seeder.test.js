import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDatabaseSeeder } from '../src/seeder/databaseSeeder.js';
import { buildEmployees, buildNodes, ORG_TREE } from '../src/seeder/orgTree.js';
import {
  createFakeEmployeeRepository,
  createFakeNodeRepository,
  createIdGenerator,
  fakePasswordEncoder,
} from './helpers/fakes.js';

const silentLogger = { log() {} };

function setup(options = {}) {
  const newId = createIdGenerator();
  const nodeRepository = createFakeNodeRepository([], newId);
  const employeeRepository = createFakeEmployeeRepository([], newId);
  const seeder = createDatabaseSeeder({
    nodeRepository,
    employeeRepository,
    passwordEncoder: fakePasswordEncoder,
    logger: silentLogger,
    ...options,
  });
  return { nodeRepository, employeeRepository, seeder, newId };
}

describe('org tree', () => {
  const nodes = buildNodes(ORG_TREE, createIdGenerator());
  const byName = (name) => nodes.find((n) => n.name === name);

  it('has the 23 nodes of the diagram: 14 offices and 9 stores', () => {
    assert.equal(nodes.length, 23);
    assert.equal(nodes.filter((n) => n.type === 'STORE').length, 9);
    assert.equal(nodes.filter((n) => n.type === 'OFFICE').length, 14);
  });

  it('has a single root without parent and ancestors', () => {
    const roots = nodes.filter((n) => n.parentId === null);
    assert.equal(roots.length, 1);
    assert.equal(roots[0].name, 'Srbija');
    assert.deepEqual(roots[0].ancestors, []);
  });

  it('stores the ancestors ordered root -> direct parent', () => {
    const radnja6 = byName('Radnja 6');
    const expected = ['Srbija', 'Grad Beograd', 'Novi Beograd', 'Bezanija'].map((n) => byName(n).id);
    assert.deepEqual(radnja6.ancestors, expected);
    assert.equal(radnja6.parentId, byName('Bezanija').id);
  });

  it('creates 1 manager + 2 employees per node with unique usernames', () => {
    const people = buildEmployees(nodes, 'some-hash');
    assert.equal(people.length, 69);
    assert.equal(people.filter((p) => p.role === 'MANAGER').length, 23);
    assert.equal(new Set(people.map((p) => p.username)).size, 69);
  });

  it('names users like <nodename>.<role><n> (lower case, no spaces)', () => {
    const usernames = buildEmployees(nodes, 'some-hash').map((p) => p.username);
    for (const expected of ['srbija.manager1', 'novisad.employee2', 'radnja6.manager1', 'novibeograd.manager1', 'severnobackiokrug.manager1']) {
      assert.ok(usernames.includes(expected), `missing ${expected}`);
    }
  });
});

describe('DatabaseSeeder', () => {
  it('seeds an empty database with 23 nodes and 69 people whose password is hashed', async () => {
    const { nodeRepository, employeeRepository, seeder } = setup();
    await seeder.run();

    assert.equal(await nodeRepository.count(), 23);
    assert.equal(await employeeRepository.count(), 69);
    const root = await employeeRepository.findByUsername('srbija.manager1');
    assert.equal(root.password, 'hash(password123)');
  });

  it('does nothing when the database already has data', async () => {
    const { nodeRepository, employeeRepository, seeder } = setup();
    await nodeRepository.saveAll([{ id: 'a'.repeat(24), name: 'Existing', type: 'OFFICE', parentId: null, ancestors: [] }]);

    await seeder.run();

    assert.equal(await nodeRepository.count(), 1);
    assert.equal(await employeeRepository.count(), 0);
  });

  it('wipes and reseeds when reset is requested', async () => {
    const { nodeRepository, employeeRepository, seeder } = setup({ reset: true });
    await nodeRepository.saveAll([{ id: 'a'.repeat(24), name: 'Existing', type: 'OFFICE', parentId: null, ancestors: [] }]);

    await seeder.run();

    assert.equal(await nodeRepository.count(), 23);
    assert.equal(await employeeRepository.count(), 69);
    assert.ok(!(await nodeRepository.findAll()).some((n) => n.name === 'Existing'));
  });

  it('does nothing when disabled', async () => {
    const { nodeRepository, seeder } = setup({ enabled: false });
    await seeder.run();
    assert.equal(await nodeRepository.count(), 0);
  });
});
