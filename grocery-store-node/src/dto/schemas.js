import { z } from 'zod';

import { Role } from '../models/constants.js';
import { HttpError } from '../utils/httpError.js';

// Request bodies are described with zod schemas (the equivalent of the jakarta validation
// annotations on the Java request records). Because every field is declared as a string, a client
// can't smuggle in an object such as { "$ne": null } to trick a database query.

const notBlank = z.string().trim().min(1, 'must not be blank');
const role = z.enum([Role.MANAGER, Role.EMPLOYEE], { message: 'must be MANAGER or EMPLOYEE' });

/** Body of POST /api/auth/login */
export const loginSchema = z.object({
  username: notBlank,
  password: z.string().min(1, 'must not be blank'),
});

/** Body of POST /api/employees (a manager creates an employee or another manager) */
export const createEmployeeSchema = z.object({
  name: notBlank,
  username: notBlank,
  password: z.string().min(8, 'must be at least 8 characters'),
  role,
  nodeId: notBlank,
});

/**
 * Body of PUT /api/employees/:id. name, username, role and nodeId are always replaced;
 * password is optional: when it is missing the current password stays unchanged.
 */
export const updateEmployeeSchema = z.object({
  name: notBlank,
  username: notBlank,
  password: z.string().min(8, 'must be at least 8 characters').nullish(),
  role,
  nodeId: notBlank,
});

/** Validates a request body and returns the cleaned data, or throws 400 listing what is wrong. */
export function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const field = issue.path.join('.') || 'body';
      return `${field}: ${issue.message}`;
    });
    throw new HttpError(400, `Validation failed - ${problems.join('; ')}`);
  }
  return result.data;
}
