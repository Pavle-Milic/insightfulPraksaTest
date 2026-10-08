import { Role } from '../models/constants.js';
import { HttpError } from '../utils/httpError.js';

/**
 * The single place that decides what a user may access. Every endpoint that touches a node or
 * an employee goes through here, so the rules are never duplicated.
 *
 * IMPORTANT: most methods are async (they read the database), so callers must always "await" them.
 * Forgetting an await on a check like requireAccessToNode() would silently skip the check.
 */
export function createAccessService({ employeeRepository, nodeRepository }) {
  /** Loads the user behind a token. Always read from the db so role/node changes apply immediately. */
  async function currentUser(username) {
    const user = await employeeRepository.findByUsername(username);
    if (!user) {
      throw new HttpError(401, 'User no longer exists');
    }
    return user;
  }

  /** The node itself plus all its descendants, as a Set of ids. */
  async function subtreeNodeIds(nodeId) {
    const descendants = await nodeRepository.findDescendantsOf(nodeId);
    return new Set([nodeId, ...descendants.map((node) => node.id)]);
  }

  /**
   * Ids of every node the user may access: their own node plus all its descendants.
   *
   * Per the task this is the same scope for managers and employees (they differ in WHAT they
   * see inside a node: managers see employees and managers, employees see only employees, and
   * only managers may modify). If employees should be limited to their own node only, this
   * is the one place to change.
   */
  function accessibleNodeIds(user) {
    return subtreeNodeIds(user.nodeId);
  }

  async function canAccessNode(user, nodeId) {
    const ids = await accessibleNodeIds(user);
    return ids.has(nodeId);
  }

  /** Throws 403 if the user may not access the node. */
  async function requireAccessToNode(user, nodeId) {
    if (!(await canAccessNode(user, nodeId))) {
      throw new HttpError(403, 'Access denied to this node');
    }
  }

  /** Throws 403 unless the user is a manager. "action" completes the message: "Only managers can ...". */
  function requireManager(user, action = 'modify employees') {
    if (user.role !== Role.MANAGER) {
      throw new HttpError(403, `Only managers can ${action}`);
    }
  }

  /** Throws 403 if the person belongs to a node outside the user's own node and its descendants. */
  async function requireAccessToEmployee(user, target) {
    if (!(await canAccessNode(user, target.nodeId))) {
      throw new HttpError(403, 'Access denied to this employee');
    }
  }

  return {
    currentUser,
    subtreeNodeIds,
    accessibleNodeIds,
    canAccessNode,
    requireAccessToNode,
    requireManager,
    requireAccessToEmployee,
  };
}
