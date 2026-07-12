/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import QRCode from 'qrcode';
import Asset from '../models/Asset.js';
import User from '../models/User.js';
import History from '../models/History.js';
import Issue from '../models/Issue.js';
import { cacheService } from '../config/cache.js';
import { aiService } from '../services/ai.service.js';

export const getAssets = async (req, res) => {
  const { search, status, category, location, technician } = req.query;
  const query = {};

  if (search) {
    const q = new RegExp(search, 'i');
    query.$or = [
      { assetName: q },
      { assetCode: q },
      { location: q }
    ];
  }
  if (status) {
    query.status = status;
  }
  if (category) {
    query.category = category;
  }
  if (location) {
    query.location = new RegExp(location, 'i');
  }
  if (technician) {
    query.assignedTechnician = technician;
  }

  const cacheKey = `assets:list:${JSON.stringify(req.query)}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({ assets: cached });
    }

    const assets = await Asset.find(query);
    await cacheService.set(cacheKey, assets, 300); // cache for 5 minutes
    res.json({ assets });
  } catch (err) {
    console.error("getAssets error:", err);
    res.status(500).json({ error: 'Server error retrieving assets' });
  }
};

export const getAssetById = async (req, res) => {
  const cacheKey = `assets:id:${req.params.id}`;
  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({ asset: cached });
    }

    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    await cacheService.set(cacheKey, asset, 300); // cache for 5 minutes
    res.json({ asset });
  } catch (err) {
    console.error("getAssetById error:", err);
    res.status(500).json({ error: 'Server error retrieving asset' });
  }
};

export const getAssetPublic = async (req, res) => {
  const cacheKey = `assets:public:${req.params.code}`;
  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const asset = await Asset.findOne({ assetCode: { $regex: new RegExp(`^${req.params.code}$`, 'i') } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset or QR label code is invalid or retired.' });
    }

    const publicAsset = {
      id: asset._id,
      assetName: asset.assetName,
      assetCode: asset.assetCode,
      category: asset.category,
      location: asset.location,
      status: asset.status,
      condition: asset.condition,
      lastService: asset.lastService,
      nextService: asset.nextService,
      createdAt: asset.createdAt
    };

    const history = await History.find({ assetId: asset._id }).sort({ timestamp: -1 });

    // Filter out internal/cost info
    const filteredHistory = history.filter(h => 
      !h.action.toLowerCase().includes('cost') && 
      !h.action.toLowerCase().includes('part')
    ).slice(0, 5);

    const result = { asset: publicAsset, history: filteredHistory };
    await cacheService.set(cacheKey, result, 300); // cache for 5 minutes
    res.json(result);
  } catch (err) {
    console.error("getAssetPublic error:", err);
    res.status(500).json({ error: 'Server error retrieving public asset page' });
  }
};

export const createAsset = async (req, res) => {
  const { assetName, assetCode, category, location, condition, assignedTechnician, nextService } = req.body;

  if (!assetName || !assetCode || !category || !location) {
    return res.status(400).json({ error: 'Missing required asset fields.' });
  }

  try {
    const existing = await Asset.findOne({ assetCode: { $regex: new RegExp(`^${assetCode}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ error: 'An asset with this code already exists.' });
    }

    let techName = null;
    if (assignedTechnician) {
      const tech = await User.findById(assignedTechnician);
      if (tech) techName = tech.name;
    }

    const PORT = 3000;
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const publicURL = `/asset/public/${assetCode}`;
    const fullPublicLink = `${appUrl}${publicURL}`;

    // Generate QR code data URI
    let qrCodeDataUri = '';
    try {
      qrCodeDataUri = await QRCode.toDataURL(fullPublicLink, {
        margin: 2,
        width: 300,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR Code', err);
    }

    const newAssetId = `ast-${Date.now()}`;
    const newAsset = new Asset({
      _id: newAssetId,
      assetName,
      assetCode,
      category,
      location,
      condition: condition || 'Excellent',
      status: 'Operational',
      assignedTechnician: assignedTechnician || null,
      assignedTechnicianName: techName,
      lastService: '',
      nextService: nextService || '',
      qrCode: qrCodeDataUri,
      publicURL,
      createdBy: req.userId,
      createdAt: new Date()
    });

    await newAsset.save();

    // Log history
    const historyRecord = new History({
      _id: `hst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      assetId: newAssetId,
      action: 'Asset Registered',
      performedBy: `${req.userName} (Admin)`,
      timestamp: new Date()
    });
    await historyRecord.save();

    await cacheService.invalidatePattern('assets:');
    await cacheService.invalidatePattern('dashboard:');

    res.status(201).json({ asset: newAsset });
  } catch (err) {
    console.error("createAsset error:", err);
    res.status(500).json({ error: 'Server error creating asset' });
  }
};

export const updateAsset = async (req, res) => {
  const { assetName, category, location, condition, status, assignedTechnician, nextService } = req.body;

  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    let techName = null;
    if (assignedTechnician) {
      const tech = await User.findById(assignedTechnician);
      if (tech) techName = tech.name;
    }

    const oldStatus = asset.status;
    const oldTech = asset.assignedTechnician;

    asset.assetName = assetName || asset.assetName;
    asset.category = category || asset.category;
    asset.location = location || asset.location;
    asset.condition = condition || asset.condition;
    asset.status = status || asset.status;
    asset.nextService = nextService !== undefined ? nextService : asset.nextService;

    if (assignedTechnician !== undefined) {
      asset.assignedTechnician = assignedTechnician || null;
      asset.assignedTechnicianName = techName;
    }

    await asset.save();

    // History tracking of primary field updates
    if (status && status !== oldStatus) {
      const historyRecord = new History({
        _id: `hst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        assetId: asset._id,
        action: `Status updated to ${status}`,
        performedBy: `${req.userName} (Admin)`,
        timestamp: new Date()
      });
      await historyRecord.save();
    }
    if (assignedTechnician !== undefined && assignedTechnician !== oldTech) {
      const actionText = techName ? `Assigned technician to ${techName}` : 'Removed assigned technician';
      const historyRecord = new History({
        _id: `hst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        assetId: asset._id,
        action: actionText,
        performedBy: `${req.userName} (Admin)`,
        timestamp: new Date()
      });
      await historyRecord.save();
    }
    if (!status && (assignedTechnician === undefined || assignedTechnician === oldTech)) {
      const historyRecord = new History({
        _id: `hst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        assetId: asset._id,
        action: 'Asset details edited',
        performedBy: `${req.userName} (Admin)`,
        timestamp: new Date()
      });
      await historyRecord.save();
    }

    await cacheService.invalidatePattern('assets:');
    await cacheService.invalidatePattern('dashboard:');

    res.json({ asset });
  } catch (err) {
    console.error("updateAsset error:", err);
    res.status(500).json({ error: 'Server error updating asset' });
  }
};

export const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    await Asset.findByIdAndDelete(req.params.id);
    // Cascade delete issues and history associated with this asset
    await Issue.deleteMany({ assetId: req.params.id });
    await History.deleteMany({ assetId: req.params.id });

    await cacheService.invalidatePattern('assets:');
    await cacheService.invalidatePattern('dashboard:');

    res.json({ message: 'Asset successfully deleted.' });
  } catch (err) {
    console.error("deleteAsset error:", err);
    res.status(500).json({ error: 'Server error deleting asset' });
  }
};

export const getAssetHistory = async (req, res) => {
  const cacheKey = `assets:history:${req.params.id}`;
  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({ history: cached });
    }

    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    const history = await History.find({ assetId: req.params.id }).sort({ timestamp: -1 });
    await cacheService.set(cacheKey, history, 300); // cache for 5 minutes
    res.json({ history });
  } catch (err) {
    console.error("getAssetHistory error:", err);
    res.status(500).json({ error: 'Server error retrieving asset history' });
  }
};

export const getAssetAIInsights = async (req, res) => {
  const assetId = req.params.id;
  try {
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    const healthScore = await aiService.calculateAssetHealthScore(assetId);
    const riskAssessment = await aiService.calculateRiskAssessment(assetId);
    const preventive = await aiService.getPreventiveRecommendation(assetId);

    res.json({
      healthScore,
      riskAssessment,
      preventive
    });
  } catch (err) {
    console.error("getAssetAIInsights error:", err);
    res.status(500).json({ error: 'Server error generating AI insights' });
  }
};
