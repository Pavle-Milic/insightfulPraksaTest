import assert from 'node:assert/strict';

import { DuplicateKeyError } from '../../src/repositories/errors.js';
import { buildEmployees, buildNodes, DEFAULT_PASSWORD, ORG_TREE } from '../../src/seeder/orgTree.js';
import { createAccessService } from '../../src/services/accessService.js';
import { createAuthService } from '../../src/services/authService.js';
import { createEmployeeService } from '../../src/services/employeeService.js';
import { HttpError } from '../../src/utils/httpError.js';

// In-memory stand-ins for the real repositories, password encoder and JWT service.
// Because the services receive their dependencies as arguments, the tests can run them
// without MongoDB, bcrypt or jsonwebtoken.

const copy = (value) => (value ? structuredClone(value) : null);

/** Ids like 000000000000000000000001: valid 24-character hex strings, like real ObjectIds. */
export function createIdGenerator() {
  let counter = 0;
  return () => (++counter).toString(16).padStart(24, '0');
}

export const fakePasswordEncoder = {
  encode: async (plain) => `hash(${plain})`,
  matches: async (plain, hash) => hash === `hash(${plain})`,
};

export const fakeJwtService = {
  sign: (subject) => ({ token: `token-for-${subject}`, expiresAt: new Date('2030-01-01T00:00:00.000Z') }),
};

export function createFakeNodeRepository(initialNodes = [], newId = createIdGenerator()) {
  const store = initialNodes.map(copy);
  return {
    newId,
    findAll: async () => store.map(copy),
    findById: async (id) => copy(store.find((node) => node.id === id)),
    findDescendantsOf: async (nodeId) => store.filter((node) => node.ancestors.includes(nodeId)).map(copy),
    count: async () => store.length,
    deleteAll: async () => {
      store.length = 0;
    },
    saveAll: async (nodes) => {
      store.push(...nodes.map(copy));
    },
    all: () => store.map(copy),
  };
}

export function createFakeEmployeeRepository(initialEmployees = [], newId = createIdGenerator()) {
  const store = initialEmployees.map(copy);
  return {
    findById: async (id) => copy(store.find((e) => e.id === id)),
    findByUsername: async (username) => copy(store.find((e) => e.username === username)),
    findByNodeIdAndRole: async (nodeId, role) =>
      store.filter((e) => e.nodeId === nodeId && e.role === role).map(copy),
    findByNodeIdInAndRole: async (nodeIds, role) =>
      store.filter((e) => nodeIds.includes(e.nodeId) && e.role === role).map(copy),
    // behaves like the real one: a unique index on username
    save: async (employee) => {
      if (store.some((e) => e.username === employee.username && e.id !== employee.id)) {
        throw new DuplicateKeyError();
      }
      if (!employee.id) {
        const created = { ...employee, id: newId() };
        store.push(created);
        return copy(created);
      }
      const index = store.findIndex((e) => e.id === employee.id);
      if (index === -1) {
        return null;
      }
      store[index] = copy(employee);
      return copy(store[index]);
    },
    deleteById: async (id) => {
      const index = store.findIndex((e) => e.id === id);
      if (index !== -1) {
        store.splice(index, 1);
      }
    },
    count: async () => store.length,
    deleteAll: async () => {
      store.length = 0;
    },
    saveAll: async (employees) => {
      store.push(...employees.map((e) => ({ ...copy(e), id: newId() })));
    },
    all: () => store.map(copy),
  };
}

/**
 * The whole org tree from the task (23 nodes, 69 people: the same data the seeder creates),
 * with real services wired to the in-memory repositories.
 */
export async function createWorld() {
  const newId = createIdGenerator();
  const nodes = buildNodes(ORG_TREE, newId);
  const passwordHash = await fakePasswordEncoder.encode(DEFAULT_PASSWORD);
  const employees = buildEmployees(nodes, passwordHash).map((e) => ({ ...e, id: newId() }));

  const nodeRepository = createFakeNodeRepository(nodes, newId);
  const employeeRepository = createFakeEmployeeRepository(employees, newId);
  const accessService = createAccessService({ employeeRepository, nodeRepository });
  const employeeService = createEmployeeService({
    employeeRepository,
    accessService,
    passwordEncoder: fakePasswordEncoder,
  });
  const authService = createAuthService({
    employeeRepository,
    passwordEncoder: fakePasswordEncoder,
    jwtService: fakeJwtService,
  });

  return {
    nodeRepository,
    employeeRepository,
    accessService,
    employeeService,
    authService,

    /** The node with this name (throws on a typo, so a wrong test fails loudly). */
    node(name) {
      const found = nodes.find((n) => n.name === name);
      assert.ok(found, `no node called "${name}"`);
      return found;
    },

    /** The user as the auth middleware would load it for a request (a fresh copy from the repository). */
    async user(username) {
      const found = await employeeRepository.findByUsername(username);
      assert.ok(found, `no user called "${username}"`);
      return found;
    },

    /** Node ids -> sorted node names, to make assertions readable. */
    namesOf(ids) {
      return [...ids].map((id) => nodes.find((n) => n.id === id).name).sort();
    },
  };
}

/** Asserts that fn() (sync or async) fails with an HttpError of the given status (and message). */
export async function assertHttpError(fn, status, message) {
  await assert.rejects(
    async () => fn(),
    (error) => {
      assert.ok(error instanceof HttpError, `expected an HttpError but got: ${error}`);
      assert.equal(error.status, status);
      if (message !== undefined) {
        assert.equal(error.message, message);
      }
      return true;
    },
  );
}

export const usernames = (people) => people.map((p) => p.username).sort();
