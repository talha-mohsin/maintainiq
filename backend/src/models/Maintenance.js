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

// Indexes for frequent query patterns
maintenanceSchema.index({ assetId: 1, completedDate: -1 }); // maintenance history by asset
maintenanceSchema.index({ issueId: 1 });                    // resolve: find maint by issue

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
export default Maintenance;
