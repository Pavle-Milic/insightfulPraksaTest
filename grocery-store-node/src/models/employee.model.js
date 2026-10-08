import mongoose from 'mongoose';

import { Role } from './constants.js';

/**
 * A user of the system. Both managers and ordinary employees live in this collection,
 * told apart by "role". Every user belongs to exactly one node.
 */
const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    // BCrypt hash, never the plain-text password
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(Role), required: true },
    nodeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { collection: 'employees', versionKey: false },
);

employeeSchema.index({ nodeId: 1, role: 1 }, { name: 'nodeId_role' });

export const EmployeeModel = mongoose.model('Employee', employeeSchema);
