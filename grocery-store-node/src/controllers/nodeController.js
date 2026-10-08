import { Router } from 'express';

import { toNodeDto } from '../dto/mappers.js';
import { HttpError } from '../utils/httpError.js';
import { normalizeObjectId } from '../utils/objectId.js';

// Mounted at /api/nodes
export function createNodeController({ nodeRepository, accessService, employeeService }) {
  const router = Router();

  /** 404 when the id is malformed or no such node exists. */
  async function findNode(id) {
    const nodeId = normalizeObjectId(id);
    const node = nodeId ? await nodeRepository.findById(nodeId) : null;
    if (!node) {
      throw new HttpError(404, 'Node not found');
    }
    return node;
  }

  /** The whole tree (basic info only), so a UI can draw it. Any logged-in user may call this. */
  router.get('/', async (req, res) => {
    const nodes = await nodeRepository.findAll();
    res.json(nodes.map(toNodeDto));
  });

  /**
   * Ids of the nodes the logged-in user may access.
   * NOTE: this route must be declared BEFORE '/:id', otherwise Express would treat the word
   * "visible" as a node id. (Spring picks the most specific route by itself, Express goes top to bottom.)
   */
  router.get('/visible', async (req, res) => {
    const ids = await accessService.accessibleNodeIds(req.user);
    res.json([...ids]);
  });

  /** One node. 404 if it doesn't exist, 403 if the user may not access it. */
  router.get('/:id', async (req, res) => {
    const node = await findNode(req.params.id);
    await accessService.requireAccessToNode(req.user, node.id);
    res.json(toNodeDto(node));
  });

  /** The people with role EMPLOYEE in this node only (descendants are not included). */
  router.get('/:id/employees', async (req, res) => {
    const node = await findNode(req.params.id);
    res.json(await employeeService.findEmployeesInNode(req.user, node.id));
  });

  /** The people with role EMPLOYEE in this node and in all its descendants. */
  router.get('/:id/employees/with-descendants', async (req, res) => {
    const node = await findNode(req.params.id);
    res.json(await employeeService.findEmployeesInNodeAndDescendants(req.user, node.id));
  });

  /** The people with role MANAGER in this node only. Managers only. */
  router.get('/:id/managers', async (req, res) => {
    const node = await findNode(req.params.id);
    res.json(await employeeService.findManagersInNode(req.user, node.id));
  });

  /** The people with role MANAGER in this node and in all its descendants. Managers only. */
  router.get('/:id/managers/with-descendants', async (req, res) => {
    const node = await findNode(req.params.id);
    res.json(await employeeService.findManagersInNodeAndDescendants(req.user, node.id));
  });

  return router;
}
