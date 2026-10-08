import { Router } from 'express';

import { loginSchema, parseBody } from '../dto/schemas.js';

// Mounted at /api/auth
export function createAuthController({ authService }) {
  const router = Router();

  router.post('/login', async (req, res) => {
    const request = parseBody(loginSchema, req.body);
    res.json(await authService.login(request));
  });

  return router;
}
