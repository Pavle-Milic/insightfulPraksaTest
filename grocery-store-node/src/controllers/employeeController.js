import { Router } from 'express';

import { createEmployeeSchema, parseBody, updateEmployeeSchema } from '../dto/schemas.js';
import { HttpError } from '../utils/httpError.js';
import { normalizeObjectId } from '../utils/objectId.js';

// Mounted at /api/employees. Works for both employees and managers (they differ only by "role").
export function createEmployeeController({ employeeService }) {
  const router = Router();

  function parseId(id) {
    const employeeId = normalizeObjectId(id);
    if (!employeeId) {
      throw new HttpError(404, 'Employee not found');
    }
    return employeeId;
  }

  router.post('/', async (req, res) => {
    const request = parseBody(createEmployeeSchema, req.body);
    const created = await employeeService.create(req.user, request);
    res.status(201).json(created);
  });

  router.get('/:id', async (req, res) => {
    res.json(await employeeService.findById(req.user, parseId(req.params.id)));
  });

  router.put('/:id', async (req, res) => {
    const request = parseBody(updateEmployeeSchema, req.body);
    res.json(await employeeService.update(req.user, parseId(req.params.id), request));
  });

  router.delete('/:id', async (req, res) => {
    await employeeService.remove(req.user, parseId(req.params.id));
    res.status(204).end();
  });

  return router;
}
