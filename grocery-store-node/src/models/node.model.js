import mongoose from 'mongoose';

import { NodeType } from './constants.js';

/**
 * A node of the organizational tree: either an office (Vojvodina, Bezanija, ...)
 * or a store (Radnja 1, ...).
 *
 * "ancestors" holds the ids of all nodes above this one, ordered root -> direct parent
 * (empty for the root). It lets us find every descendant of node X with { ancestors: X }.
 */
const nodeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(NodeType), required: true },
    // Direct parent node, null for the root (Srbija)
    parentId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    ancestors: { type: [mongoose.Schema.Types.ObjectId], default: [], index: true },
  },
  { collection: 'nodes', versionKey: false },
);

// Called NodeModel so it is not confused with "Node" (= Node.js) :)
export const NodeModel = mongoose.model('Node', nodeSchema);
