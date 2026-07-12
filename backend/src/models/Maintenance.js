/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose from 'mongoose';

const maintenanceSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  issueId: { type: String, ref: 'Issue', required: true },
  assetId: { type: String, ref: 'Asset', required: true },
  inspectionNotes: { type: String, default: '' },
  parts: { type: [String], default: [] },
  cost: { type: Number, default: 0 },
  evidence: { type: String, default: null },
  maintenanceDate: { type: Date, default: Date.now },
  completedDate: { type: Date, default: null },
  summary: { type: String, default: '' }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
export default Maintenance;
