import mongoose from 'mongoose';

import { NodeModel } from '../models/node.model.js';

// Repositories return plain objects with string ids, so nothing outside this folder
// needs to know about Mongoose or ObjectId.
const toNode = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  type: doc.type,
  parentId: doc.parentId ? doc.parentId.toString() : null,
  ancestors: (doc.ancestors ?? []).map(String),
});

export function createNodeRepository() {
  return {
    /** A fresh id, used by the seeder to wire parents and ancestors before saving. */
    newId: () => new mongoose.Types.ObjectId().toString(),

    async findAll() {
      const docs = await NodeModel.find().sort({ _id: 1 }).lean();
      return docs.map(toNode);
    },

    async findById(id) {
      const doc = await NodeModel.findById(id).lean();
      return doc ? toNode(doc) : null;
    },

    /** All descendants of the given node (the node itself is not included). */
    async findDescendantsOf(nodeId) {
      const docs = await NodeModel.find({ ancestors: nodeId }).lean();
      return docs.map(toNode);
    },

    count: () => NodeModel.countDocuments(),

    async deleteAll() {
      await NodeModel.deleteMany({});
    },

    async saveAll(nodes) {
      await NodeModel.insertMany(
        nodes.map((n) => ({
          _id: n.id,
          name: n.name,
          type: n.type,
          parentId: n.parentId,
          ancestors: n.ancestors,
        })),
      );
    },
  };
}
