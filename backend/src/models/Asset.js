/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  assetName: { type: String, required: true },
  assetCode: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  condition: { type: String, required: true },
  status: { type: String, enum: ['Operational', 'Under Maintenance', 'Out of Service'], default: 'Operational' },
  assignedTechnician: { type: String, ref: 'User', default: null },
  assignedTechnicianName: { type: String, default: null },
  lastService: { type: String, default: '' },
  nextService: { type: String, default: '' },
  qrCode: { type: String, default: '' },
  publicURL: { type: String, default: '' },
  createdBy: { type: String, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const Asset = mongoose.model('Asset', assetSchema);
export default Asset;
