import { toEmployeeDto } from '../dto/mappers.js';
import { Role } from '../models/constants.js';
import { DuplicateKeyError } from '../repositories/errors.js';
import { HttpError } from '../utils/httpError.js';
import { normalizeObjectId } from '../utils/objectId.js';

/**
 * Both "employees" (role EMPLOYEE) and "managers" (role MANAGER) live in one collection,
 * so the same code serves both: only the role we filter on differs.
 */
export function createEmployeeService({ employeeRepository, accessService, passwordEncoder }) {
  // ---------------------------------------------------------------- reading lists

  /** People with the given role that belong directly to the node. */
  async function listInNode(user, nodeId, role) {
    await accessService.requireAccessToNode(user, nodeId);
    const people = await employeeRepository.findByNodeIdAndRole(nodeId, role);
    return people.map(toEmployeeDto);
  }

  /** People with the given role in the node and in all its descendants. */
  async function listInNodeAndDescendants(user, nodeId, role) {
    await accessService.requireAccessToNode(user, nodeId);
    const nodeIds = [...(await accessService.subtreeNodeIds(nodeId))];
    const people = await employeeRepository.findByNodeIdInAndRole(nodeIds, role);
    return people.map(toEmployeeDto);
  }

  const findEmployeesInNode = (user, nodeId) => listInNode(user, nodeId, Role.EMPLOYEE);

  const findEmployeesInNodeAndDescendants = (user, nodeId) =>
    listInNodeAndDescendants(user, nodeId, Role.EMPLOYEE);

  // Employees may only see employees, so the manager lists are for managers only
  async function findManagersInNode(user, nodeId) {
    accessService.requireManager(user, 'view managers');
    return listInNode(user, nodeId, Role.MANAGER);
  }

  async function findManagersInNodeAndDescendants(user, nodeId) {
    accessService.requireManager(user, 'view managers');
    return listInNodeAndDescendants(user, nodeId, Role.MANAGER);
  }

  // ---------------------------------------------------------------- CRUD

  async function findById(user, id) {
    const target = await findEmployee(id);
    await accessService.requireAccessToEmployee(user, target);
    if (target.role === Role.MANAGER) {
      accessService.requireManager(user, 'view managers');
    }
    return toEmployeeDto(target);
  }

  /** Managers only. The new person must belong to the manager's own node or one of its descendants. */
  async function create(user, request) {
    accessService.requireManager(user);
    const nodeId = parseNodeId(request.nodeId);
    await accessService.requireAccessToNode(user, nodeId);
    await requireUsernameFree(request.username);

    const saved = await saveOrConflict({
      name: request.name,
      username: request.username,
      password: await passwordEncoder.encode(request.password),
      role: request.role,
      nodeId,
    });
    return toEmployeeDto(saved);
  }

  /** Replaces name, username, role and node (and the password, if one is sent). Managers only, within their scope. */
  async function update(user, id, request) {
    accessService.requireManager(user);
    const target = await findEmployee(id);
    await accessService.requireAccessToEmployee(user, target);

    // The person may only be moved to a node the manager also has access to
    const newNodeId = parseNodeId(request.nodeId);
    await accessService.requireAccessToNode(user, newNodeId);

    await requireUsernameFree(request.username, target.id);

    const updated = {
      ...target,
      name: request.name,
      username: request.username,
      role: request.role,
      nodeId: newNodeId,
    };
    if (request.password) {
      updated.password = await passwordEncoder.encode(request.password);
    }

    const saved = await saveOrConflict(updated);
    if (!saved) {
      throw new HttpError(404, 'Employee not found');
    }
    return toEmployeeDto(saved);
  }

  /** Managers only, within their scope. */
  async function remove(user, id) {
    accessService.requireManager(user);
    const target = await findEmployee(id);
    await accessService.requireAccessToEmployee(user, target);
    await employeeRepository.deleteById(target.id);
  }

  // ---------------------------------------------------------------- helpers

  async function findEmployee(id) {
    const employee = await employeeRepository.findById(id);
    if (!employee) {
      throw new HttpError(404, 'Employee not found');
    }
    return employee;
  }

  function parseNodeId(nodeId) {
    const normalized = normalizeObjectId(nodeId);
    if (!normalized) {
      throw new HttpError(400, 'Invalid nodeId');
    }
    return normalized;
  }

  /** 409 when another person already uses the username (ignoring the person being updated). */
  async function requireUsernameFree(username, ownId = null) {
    const other = await employeeRepository.findByUsername(username);
    if (other && other.id !== ownId) {
      throw new HttpError(409, 'Username already taken');
    }
  }

  async function saveOrConflict(employee) {
    try {
      return await employeeRepository.save(employee);
    } catch (error) {
      if (error instanceof DuplicateKeyError) {
        // Two requests racing for the same username: the unique index has the last word
        throw new HttpError(409, 'Username already taken');
      }
      throw error;
    }
  }

  return {
    findEmployeesInNode,
    findEmployeesInNodeAndDescendants,
    findManagersInNode,
    findManagersInNodeAndDescendants,
    findById,
    create,
    update,
    remove,
  };
}
