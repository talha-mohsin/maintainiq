/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  _id: { type: String, required: true },
  assetId: { type: String, ref: 'Asset', required: true },
  action: { type: String, required: true },
  performedBy: { type: String, required: true },
  issueId: { type: String, ref: 'Issue', default: null },
  timestamp: { type: Date, default: Date.now }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for frequent query patterns
historySchema.index({ assetId: 1, timestamp: -1 }); // asset history page: sorted by newest
historySchema.index({ issueId: 1 });                 // issue-specific history lookup

const History = mongoose.model('History', historySchema);
export default History;
