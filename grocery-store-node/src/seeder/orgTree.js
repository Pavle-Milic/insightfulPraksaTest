import { NodeType, Role } from '../models/constants.js';

// The org structure, exactly as in the diagram of the task.
// This file is plain data + pure functions (no database), so it can be tested on its own.

const office = (name, ...children) => ({ name, type: NodeType.OFFICE, children });
const store = (name) => ({ name, type: NodeType.STORE, children: [] });

export const ORG_TREE = office(
  'Srbija',
  office(
    'Vojvodina',
    office('Severnobacki okrug', office('Subotica', store('Radnja 1'))),
    office(
      'Juznobacki okrug',
      office(
        'Novi Sad',
        office('Detelinara', store('Radnja 2'), store('Radnja 3')),
        office('Liman', store('Radnja 4'), store('Radnja 5')),
      ),
    ),
  ),
  office(
    'Grad Beograd',
    office('Novi Beograd', office('Bezanija', store('Radnja 6'))),
    office(
      'Vracar',
      office('Neimar', store('Radnja 7')),
      office('Crveni krst', store('Radnja 8'), store('Radnja 9')),
    ),
  ),
);

export const EMPLOYEES_PER_NODE = 2;
export const DEFAULT_PASSWORD = 'password123';

/**
 * Walks the tree depth-first and returns a flat list of nodes.
 * "ancestors" holds the ids of everything above the current unit, ordered root -> direct parent
 * (empty for the root). "newId" is a function that produces a fresh id.
 */
export function buildNodes(unit, newId, parentId = null, ancestors = [], out = []) {
  const id = newId();
  out.push({ id, name: unit.name, type: unit.type, parentId, ancestors: [...ancestors] });

  const childAncestors = [...ancestors, id];
  for (const child of unit.children) {
    buildNodes(child, newId, id, childAncestors, out);
  }
  return out;
}

/** 1 manager + EMPLOYEES_PER_NODE employees for every node. */
export function buildEmployees(nodes, passwordHash) {
  const result = [];
  for (const node of nodes) {
    result.push(newEmployee(node, Role.MANAGER, 1, passwordHash));
    for (let i = 1; i <= EMPLOYEES_PER_NODE; i++) {
      result.push(newEmployee(node, Role.EMPLOYEE, i, passwordHash));
    }
  }
  return result;
}

function newEmployee(node, role, counter, passwordHash) {
  const label = `${role.toLowerCase()}${counter}`; // manager1, employee2
  const name = `${node.name} ${label}`; // "Novi Sad manager1"
  const username = `${node.name.toLowerCase().replace(/\s+/g, '')}.${label}`; // "novisad.manager1"
  return { name, username, password: passwordHash, role, nodeId: node.id };
}
