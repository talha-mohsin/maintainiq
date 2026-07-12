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

const History = mongoose.model('History', historySchema);
export default History;
