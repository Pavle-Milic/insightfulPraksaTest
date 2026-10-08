import { EmployeeModel } from '../models/employee.model.js';
import { DuplicateKeyError } from './errors.js';

const toEmployee = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  username: doc.username,
  password: doc.password,
  role: doc.role,
  nodeId: doc.nodeId.toString(),
});

// 11000 is MongoDB's "duplicate key" error code. We translate it into our own error type so the
// services don't need to know anything about MongoDB.
function rethrowDuplicateKey(error) {
  if (error?.code === 11000) {
    throw new DuplicateKeyError();
  }
  throw error;
}

export function createEmployeeRepository() {
  return {
    async findById(id) {
      const doc = await EmployeeModel.findById(id).lean();
      return doc ? toEmployee(doc) : null;
    },

    async findByUsername(username) {
      const doc = await EmployeeModel.findOne({ username }).lean();
      return doc ? toEmployee(doc) : null;
    },

    async findByNodeIdAndRole(nodeId, role) {
      const docs = await EmployeeModel.find({ nodeId, role }).sort({ _id: 1 }).lean();
      return docs.map(toEmployee);
    },

    /** Same as above but for several nodes at once (used for "node + all descendants"). */
    async findByNodeIdInAndRole(nodeIds, role) {
      const docs = await EmployeeModel.find({ nodeId: { $in: nodeIds }, role }).sort({ _id: 1 }).lean();
      return docs.map(toEmployee);
    },

    /**
     * Inserts the employee when it has no id yet, otherwise replaces its fields.
     * Returns the saved employee (null if an update targeted a document that no longer exists).
     */
    async save(employee) {
      const fields = {
        name: employee.name,
        username: employee.username,
        password: employee.password,
        role: employee.role,
        nodeId: employee.nodeId,
      };
      try {
        if (!employee.id) {
          const doc = await EmployeeModel.create(fields);
          return toEmployee(doc.toObject());
        }
        const doc = await EmployeeModel.findByIdAndUpdate(
          employee.id,
          { $set: fields },
          { new: true, runValidators: true },
        ).lean();
        return doc ? toEmployee(doc) : null;
      } catch (error) {
        return rethrowDuplicateKey(error);
      }
    },

    async deleteById(id) {
      await EmployeeModel.deleteOne({ _id: id });
    },

    count: () => EmployeeModel.countDocuments(),

    async deleteAll() {
      await EmployeeModel.deleteMany({});
    },

    async saveAll(employees) {
      await EmployeeModel.insertMany(
        employees.map((e) => ({
          name: e.name,
          username: e.username,
          password: e.password,
          role: e.role,
          nodeId: e.nodeId,
        })),
      );
    },
  };
}
