import { fileURLToPath } from 'node:url';
import express from 'express';

import { createAuthController } from './controllers/authController.js';
import { createEmployeeController } from './controllers/employeeController.js';
import { createNodeController } from './controllers/nodeController.js';
import { createAuthMiddleware } from './middleware/authMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

/**
 * Builds the Express application. The ORDER of the lines below matters: a request travels
 * through them from top to bottom until something answers it.
 *
 * Stateless JWT security: everything under /api needs a valid bearer token except the login endpoint.
 */
export function createApp({ jwtService, accessService, authService, employeeService, nodeRepository }) {
  const app = express();
  const publicDir = fileURLToPath(new URL('./public', import.meta.url));

  app.use(express.json()); // parses JSON request bodies into req.body
  app.use(express.static(publicDir));

  // Public: login
  app.use('/api/auth', createAuthController({ authService }));

  // Everything declared below this line needs a valid token
  app.use('/api', createAuthMiddleware({ jwtService, accessService }));
  app.use('/api/nodes', createNodeController({ nodeRepository, accessService, employeeService }));
  app.use('/api/employees', createEmployeeController({ employeeService }));

  app.use(notFoundHandler);
  app.use(errorHandler); // must be last

  return app;
}
