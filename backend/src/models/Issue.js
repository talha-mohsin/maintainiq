/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  issueNumber: { type: String, required: true, unique: true },
  assetId: { type: String, ref: 'Asset', required: true },
  assetName: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], required: true },
  category: { type: String, required: true },
  reporter: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Reported', 'Assigned', 'Inspection Started', 'Maintenance', 'Waiting Parts', 'Resolved', 'Closed', 'Reopened'],
    default: 'Reported' 
  },
  aiGenerated: { type: Boolean, default: false },
  possibleCauses: { type: [String], default: [] },
  initialChecks: { type: [String], default: [] },
  safetyWarning: { type: String, default: '' },
  assignedTechnician: { type: String, ref: 'User', default: null },
  assignedTechnicianName: { type: String, default: null },
  imageEvidence: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  completedDate: { type: Date, default: null }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for frequent query patterns
issueSchema.index({ assetId: 1 });                        // AI: issues by asset
issueSchema.index({ status: 1 });                         // filter by status
issueSchema.index({ priority: 1 });                       // filter by priority
issueSchema.index({ assignedTechnician: 1 });             // technician's issue queue
issueSchema.index({ createdAt: -1 });                     // newest first sort
issueSchema.index({ assetId: 1, status: 1 });             // active issues by asset (resolveIssue)
issueSchema.index({ assetId: 1, priority: 1 });           // health score calculation
issueSchema.index({ category: 1, status: 1 });            // AI technician recommendation

const Issue = mongoose.model('Issue', issueSchema);
export default Issue;
