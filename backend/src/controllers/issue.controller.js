/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import Issue from '../models/Issue.js';
import Asset from '../models/Asset.js';
import User from '../models/User.js';
import Maintenance from '../models/Maintenance.js';
import History from '../models/History.js';
import { cacheService } from '../config/cache.js';
import { aiService } from '../services/ai.service.js';

// Set up Google Gen AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const getIssues = async (req, res) => {
  const { priority, status, assignedTo, search } = req.query;
  const query = {};

  if (search) {
    const q = new RegExp(search, 'i');
    query.$or = [
      { title: q },
      { description: q },
      { issueNumber: q },
      { assetName: q }
    ];
  }
  if (priority) {
    query.priority = priority;
  }
  if (status) {
    query.status = status;
  }
  if (assignedTo) {
    query.assignedTechnician = assignedTo;
  }

  const cacheKey = `issues:list:${JSON.stringify(req.query)}`;

  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json({ issues: cached });
    }

    const issues = await Issue.find(query);
    await cacheService.set(cacheKey, issues, 300); // cache for 5 minutes
    res.json({ issues });
  } catch (err) {
    console.error("getIssues error:", err);
    res.status(500).json({ error: 'Server error retrieving issues' });
  }
};

export const triageIssueAI = async (req, res) => {
  const { description } = req.body;
  if (!description || description.trim().length < 5) {
    return res.status(400).json({ error: 'Description must be at least 5 characters long.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is not configured. Falling back to high-fidelity AI simulation.");
    return res.json({
      triage: {
        title: 'Reported Diagnostic Request',
        category: 'General',
        priority: 'Medium',
        possibleCauses: [
          'Undetermined hardware degradation',
          'Environmental stress fatigue'
        ],
        initialChecks: [
          'Verify main physical electrical power source connects securely.',
          'Conduct visual scan for physical breaches, burns, or cracks.'
        ],
        safetyWarning: 'Perform standard safety precautions. Wear appropriate gloves and insulation garments.'
      }
    });
  }

  try {
    const prompt = `Analyze this maintenance issue and perform triage. Determine a professional title, appropriate category (HVAC, Electrical, Plumbing, Structural, Transportation, IT, or General), priority level (Low, Medium, High, Critical), probable causes, diagnostic checks, and precise safety warnings: "${description}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Professional short title of the issue" },
            category: { type: Type.STRING, description: "Must be HVAC, Electrical, Plumbing, Structural, Transportation, IT, or General" },
            priority: { type: Type.STRING, description: "Must be Low, Medium, High, or Critical" },
            possibleCauses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List 2-4 possible causes"
            },
            initialChecks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List 3-4 initial inspection points"
            },
            safetyWarning: { type: Type.STRING, description: "Urgent safety warnings associated with addressing this issue (voltage, water, gas, safety gear, lock-out-tag-out)" }
          },
          required: ["title", "category", "priority", "possibleCauses", "initialChecks", "safetyWarning"]
        }
      }
    });

    const parsedTriage = JSON.parse(response.text.trim());
    res.json({ triage: parsedTriage });
  } catch (err) {
    console.error('Gemini Triage Error:', err);
    res.status(500).json({ error: 'AI Triage engine was unable to parse your request. Please manually complete triage.' });
  }
};

export const createIssue = async (req, res) => {
  const { assetId, title, description, priority, category, reporter, aiGenerated, possibleCauses, initialChecks, safetyWarning, imageEvidence } = req.body;

  if (!assetId || !title || !description || !reporter) {
    return res.status(400).json({ error: 'Asset, title, description, and reporter name are required.' });
  }

  try {
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    const allIssues = await Issue.find({});
    const lastIssueNum = allIssues
      .map(i => parseInt(i.issueNumber.replace('REQ-', '')))
      .reduce((max, val) => (val > max ? val : max), 1000);
    const nextIssueNumber = `REQ-${lastIssueNum + 1}`;

    const defaultPriority = priority || 'Medium';

    const newIssueId = `iss-${Date.now()}`;
    const newIssue = new Issue({
      _id: newIssueId,
      issueNumber: nextIssueNumber,
      assetId: asset._id,
      assetName: asset.assetName,
      title,
      description,
      priority: defaultPriority,
      category: category || asset.category || 'General',
      reporter,
      status: 'Reported',
      aiGenerated: aiGenerated || false,
      possibleCauses: possibleCauses || [],
      initialChecks: initialChecks || [],
      safetyWarning: safetyWarning || '',
      assignedTechnician: null,
      assignedTechnicianName: null,
      imageEvidence: imageEvidence || null,
      createdAt: new Date(),
      completedDate: null
    });

    await newIssue.save();

    // If priority is high or critical, update asset status to Under Maintenance or Out of Service
    if (['High', 'Critical'].includes(defaultPriority)) {
      const updatedStatus = defaultPriority === 'Critical' ? 'Out of Service' : 'Under Maintenance';
      asset.status = updatedStatus;
      await asset.save();

      const historyAuto = new History({
        _id: `hst-${Date.now()}-auto`,
        assetId: asset._id,
        action: `Status set to ${updatedStatus} (Auto-escalation)`,
        performedBy: 'System',
        timestamp: new Date()
      });
      await historyAuto.save();
    }

    const historyRecord = new History({
      _id: `hst-${Date.now()}-reported`,
      assetId: asset._id,
      action: `Issue Reported: ${nextIssueNumber} (${title})`,
      performedBy: reporter,
      issueId: newIssueId,
      timestamp: new Date()
    });
    await historyRecord.save();

    await cacheService.invalidatePattern('issues:');
    await cacheService.invalidatePattern('dashboard:');
    await cacheService.invalidatePattern('assets:');

    res.status(201).json({ issue: newIssue });
  } catch (err) {
    console.error("createIssue error:", err);
    res.status(500).json({ error: 'Server error filing issue request' });
  }
};

export const updateIssue = async (req, res) => {
  const { assignedTechnician, status, priority } = req.body;

  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    let techName = null;
    if (assignedTechnician) {
      const tech = await User.findById(assignedTechnician);
      if (tech) techName = tech.name;
    }

    const oldTechnician = issue.assignedTechnician;
    const oldStatus = issue.status;

    if (assignedTechnician !== undefined) {
      issue.assignedTechnician = assignedTechnician || null;
      issue.assignedTechnicianName = techName;
      if (assignedTechnician && issue.status === 'Reported') {
        issue.status = 'Assigned';
      }
    }
    if (status) {
      issue.status = status;
    }
    if (priority) {
      issue.priority = priority;
    }

    await issue.save();

    const performer = req.userName || 'Authorized User';

    // Update asset status automatically based on progress
    if (status && status !== oldStatus) {
      if (status === 'Inspection Started' || status === 'Maintenance') {
        const asset = await Asset.findById(issue.assetId);
        if (asset) {
          asset.status = 'Under Maintenance';
          await asset.save();
        }

        const historyStatus = new History({
          _id: `hst-${Date.now()}-status`,
          assetId: issue.assetId,
          action: `Status updated to Under Maintenance`,
          performedBy: performer,
          timestamp: new Date()
        });
        await historyStatus.save();
      }

      const historyIssueStatus = new History({
        _id: `hst-${Date.now()}-iss-status`,
        assetId: issue.assetId,
        action: `Issue ${issue.issueNumber} set to status: ${status}`,
        performedBy: performer,
        issueId: issue._id,
        timestamp: new Date()
      });
      await historyIssueStatus.save();
    }

    if (assignedTechnician !== undefined && assignedTechnician !== oldTechnician) {
      const logStr = techName ? `Assigned Issue to ${techName}` : 'Removed assignment';
      const historyAssign = new History({
        _id: `hst-${Date.now()}-assign`,
        assetId: issue.assetId,
        action: `${logStr} for ${issue.issueNumber}`,
        performedBy: performer,
        issueId: issue._id,
        timestamp: new Date()
      });
      await historyAssign.save();
    }

    await cacheService.invalidatePattern('issues:');
    await cacheService.invalidatePattern('dashboard:');
    await cacheService.invalidatePattern('assets:');

    res.json({ issue });
  } catch (err) {
    console.error("updateIssue error:", err);
    res.status(500).json({ error: 'Server error updating issue logs' });
  }
};

export const resolveIssue = async (req, res) => {
  const { inspectionNotes, parts, cost, evidence, summary } = req.body;

  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    if (!inspectionNotes || !summary) {
      return res.status(400).json({ error: 'Inspection notes and repair summary are required to resolve.' });
    }

    const completeDate = new Date();

    // Create Maintenance Record
    const newMaintId = `maint-${Date.now()}`;
    const newMaint = new Maintenance({
      _id: newMaintId,
      issueId: issue._id,
      assetId: issue.assetId,
      inspectionNotes,
      parts: parts || [],
      cost: Number(cost) || 0,
      evidence: evidence || null,
      maintenanceDate: issue.createdAt,
      completedDate: completeDate,
      summary
    });

    await newMaint.save();

    // Update Issue status
    issue.status = 'Resolved';
    issue.completedDate = completeDate;
    await issue.save();

    const performer = req.userName || 'Authorized User';

    // Check if any other issues are still active on this asset
    const activeIssuesCount = await Issue.countDocuments({
      assetId: issue.assetId,
      _id: { $ne: issue._id },
      status: { $nin: ['Resolved', 'Closed'] }
    });

    if (activeIssuesCount === 0) {
      // Restore asset status to Operational
      const asset = await Asset.findById(issue.assetId);
      if (asset) {
        asset.status = 'Operational';
        asset.condition = 'Excellent'; // Repaired
        asset.lastService = completeDate.toISOString().split('T')[0];
        await asset.save();
      }

      const historyRestore = new History({
        _id: `hst-${Date.now()}-restore`,
        assetId: issue.assetId,
        action: `Asset restored to Operational after repair`,
        performedBy: performer,
        timestamp: new Date()
      });
      await historyRestore.save();
    }

    const historyResolve = new History({
      _id: `hst-${Date.now()}-resolve`,
      assetId: issue.assetId,
      action: `Resolved Issue ${issue.issueNumber} - Repair Cost: $${newMaint.cost}`,
      performedBy: performer,
      issueId: issue._id,
      timestamp: new Date()
    });
    await historyResolve.save();

    await cacheService.invalidatePattern('issues:');
    await cacheService.invalidatePattern('dashboard:');
    await cacheService.invalidatePattern('assets:');

    res.json({ message: 'Issue resolved successfully.', maintenance: newMaint });
  } catch (err) {
    console.error("resolveIssue error:", err);
    res.status(500).json({ error: 'Server error resolving issue' });
  }
};

export const generateAIDraftSummary = async (req, res) => {
  const { inspectionNotes } = req.body;
  try {
    const summary = await aiService.generateMaintenanceSummary(inspectionNotes);
    res.json({ summary });
  } catch (err) {
    console.error("generateAIDraftSummary error:", err);
    res.status(500).json({ error: err.message || 'Server error generating draft summary' });
  }
};

export const getIssueAIInsights = async (req, res) => {
  const issueId = req.params.id;
  try {
    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    const similarIssues = await aiService.findSimilarIssues(issue.description, issue.category);
    const recommendedTechnician = await aiService.recommendTechnician(issue.category);
    const estimates = await aiService.estimateRepairTimeAndCost(issue.description, issue.category);
    const healthScore = await aiService.calculateAssetHealthScore(issue.assetId);
    const riskAssessment = await aiService.calculateRiskAssessment(issue.assetId);

    res.json({
      similarIssues,
      recommendedTechnician,
      estimates,
      healthScore,
      riskAssessment
    });
  } catch (err) {
    console.error("getIssueAIInsights error:", err);
    res.status(500).json({ error: 'Server error retrieving issue AI insights' });
  }
};
