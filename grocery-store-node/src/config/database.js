import mongoose from 'mongoose';

import { EmployeeModel } from '../models/employee.model.js';
import { NodeModel } from '../models/node.model.js';

export async function connectDatabase(uri) {
  // Fail after 5 seconds (instead of the default 30) when MongoDB is not running
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  // Mongoose creates the indexes declared in the schemas (unique username, ...) in the background.
  // init() waits until they exist, so the seeder never runs against a half-built collection.
  await Promise.all([NodeModel.init(), EmployeeModel.init()]);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
