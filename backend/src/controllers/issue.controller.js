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
import { ValidationError, NotFoundError, ForbiddenError, ApiError } from '../utils/ApiError.js';
import { cacheService } from '../config/cache.js';
import { aiService } from '../services/ai.service.js';

// Valid forward-progress transitions for the generic update endpoint.
// "Resolved" is intentionally excluded — it may only be reached via
// POST /:id/resolve, which enforces a mandatory maintenance note.
// "Reopened" is intentionally excluded — it may only be reached via
// POST /:id/reopen.
const ALLOWED_STATUS_TRANSITIONS = {
  Reported: ['Assigned'],
  Assigned: ['Inspection Started', 'Waiting Parts', 'Reported'],
  'Inspection Started': ['Maintenance', 'Waiting Parts'],
  Maintenance: ['Waiting Parts'],
  'Waiting Parts': ['Inspection Started', 'Maintenance'],
  Reopened: ['Assigned', 'Inspection Started', 'Maintenance', 'Waiting Parts'],
  Resolved: [],
  Closed: [],
};

// Maps an issue status transition to the resulting asset status (Agent.md §5.1).
const ASSET_STATUS_FOR_ISSUE_STATUS = {
  'Inspection Started': 'Under Inspection',
  'Maintenance': 'Under Maintenance',
};

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

  // Validation is handled by middleware; still ensure required fields exist
  if (!assetId || !title || !description || !reporter) {
    throw new ValidationError('Asset, title, description, and reporter are required.');
  }

  const asset = await Asset.findById(assetId);
  if (!asset) {
    throw new NotFoundError('Asset not found.');
  }
  if (asset.status === 'Retired') {
    throw new ValidationError('This asset has been retired and is no longer in active service.');
  }

  // Determine next issue number
  const latestIssue = await Issue.find({}).sort({ createdAt: -1 }).limit(1);
  const lastIssueNum = latestIssue.length > 0
    ? (parseInt(latestIssue[0].issueNumber.replace('REQ-', ''), 10) || 1000)
    : 1000;
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

  // Update asset status per Agent.md §5.1: a new issue always moves the
  // asset to "Issue Reported"; a Critical safety issue additionally takes
  // it out of service immediately, regardless of current state.
  const nextAssetStatus = defaultPriority === 'Critical'
    ? 'Out of Service'
    : (asset.status === 'Operational' ? 'Issue Reported' : null);

  if (nextAssetStatus && nextAssetStatus !== asset.status) {
    asset.status = nextAssetStatus;
    await asset.save();

    const historyAuto = new History({
      _id: `hst-${Date.now()}-auto`,
      assetId: asset._id,
      action: `Status set to ${nextAssetStatus} (Auto-escalation)`,
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

  res.status(201).json({
    success: true,
    message: 'Issue created successfully.',
    errorCode: null,
    data: { issue: newIssue }
  });
};

export const updateIssue = async (req, res) => {
  const { assignedTechnician, status, priority, title, description, category } = req.body;

  try {
    // req.issue is preloaded + ownership-checked by authorizeIssueAccess middleware
    const issue = req.issue || await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    if (issue.status === 'Closed') {
      throw new ForbiddenError('A closed issue cannot be edited. Reopen it first.');
    }

    if (status && status !== issue.status) {
      const allowedTargets = ALLOWED_STATUS_TRANSITIONS[issue.status] || [];
      if (!allowedTargets.includes(status)) {
        throw new ValidationError(
          `Cannot move issue from "${issue.status}" to "${status}". ` +
          (status === 'Resolved'
            ? 'Use the resolve endpoint (requires inspection notes and a repair summary).'
            : status === 'Reopened'
              ? 'Use the reopen endpoint.'
              : `Allowed next steps: ${allowedTargets.join(', ') || 'none'}.`)
        );
      }
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
    if (status) issue.status = status;
    if (priority) issue.priority = priority;
    if (title) issue.title = title;
    if (description) issue.description = description;
    if (category) issue.category = category;


    await issue.save();

    const performer = req.userName || 'Authorized User';

    // Update asset status automatically based on progress (Agent.md §5.1)
    if (status && status !== oldStatus) {
      const mappedAssetStatus = ASSET_STATUS_FOR_ISSUE_STATUS[status];
      if (mappedAssetStatus) {
        const asset = await Asset.findById(issue.assetId);
        if (asset) {
          asset.status = mappedAssetStatus;
          await asset.save();
        }

        const historyStatus = new History({
          _id: `hst-${Date.now()}-status`,
          assetId: issue.assetId,
          action: `Status updated to ${mappedAssetStatus}`,
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
    if (err instanceof ApiError) throw err;
    console.error("updateIssue error:", err);
    throw new ApiError('Server error updating issue logs', 500, 'ERR_INTERNAL');
  }
};

export const resolveIssue = async (req, res) => {
  const { inspectionNotes, parts, cost, evidence, summary } = req.body;

  if (!inspectionNotes || !summary) {
    throw new ValidationError('Inspection notes and repair summary are required to resolve.');
  }

  if (cost !== undefined && cost !== null && cost !== '' && Number(cost) < 0) {
    throw new ValidationError('Maintenance cost cannot be negative.');
  }

  // req.issue is preloaded + ownership-checked by authorizeIssueAccess middleware
  const issue = req.issue || await Issue.findById(req.params.id);
  if (!issue) {
    throw new NotFoundError('Issue not found.');
  }

  if (issue.status === 'Closed') {
    throw new ForbiddenError('A closed issue cannot be resolved. Reopen it first.');
  }
  if (issue.status === 'Resolved') {
    throw new ValidationError('This issue has already been resolved.');
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
    const asset = await Asset.findById(issue.assetId);
    if (asset) {
      asset.status = 'Operational';
      asset.condition = 'Excellent';
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

  res.json({
    success: true,
    message: 'Issue resolved successfully.',
    errorCode: null,
    data: { maintenance: newMaint }
  });
};

export const deleteIssue = async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    throw new NotFoundError('Issue not found.');
  }

  const performer = req.userName || 'Authorized User';

  // Log deletion in history before removing
  const historyDelete = new History({
    _id: `hst-${Date.now()}-delete`,
    assetId: issue.assetId,
    action: `Issue ${issue.issueNumber} deleted by ${performer}`,
    performedBy: performer,
    timestamp: new Date()
  });
  await historyDelete.save();

  await Issue.findByIdAndDelete(req.params.id);

  await cacheService.invalidatePattern('issues:');
  await cacheService.invalidatePattern('dashboard:');

  res.json({
    success: true,
    message: 'Issue deleted successfully.',
    errorCode: null,
    data: null
  });
};

// Explicit Resolved/Closed -> Reopened flow (Agent.md §5.2). Admin-only:
// reopening reverses a completed workflow and should not be self-served
// by the technician who closed it.
export const reopenIssue = async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    throw new NotFoundError('Issue not found.');
  }

  if (!['Resolved', 'Closed'].includes(issue.status)) {
    throw new ValidationError(`Only a Resolved or Closed issue can be reopened (current status: ${issue.status}).`);
  }

  issue.status = 'Reopened';
  issue.completedDate = null;
  await issue.save();

  const performer = req.userName || 'Authorized User';

  // Reflect the reopened work back onto the asset unless it already has
  // other active issues driving a more specific status.
  const asset = await Asset.findById(issue.assetId);
  if (asset && asset.status === 'Operational') {
    asset.status = 'Issue Reported';
    await asset.save();
  }

  const historyReopen = new History({
    _id: `hst-${Date.now()}-reopen`,
    assetId: issue.assetId,
    action: `Issue ${issue.issueNumber} reopened by ${performer}`,
    performedBy: performer,
    issueId: issue._id,
    timestamp: new Date()
  });
  await historyReopen.save();

  await cacheService.invalidatePattern('issues:');
  await cacheService.invalidatePattern('dashboard:');
  await cacheService.invalidatePattern('assets:');

  res.json({
    success: true,
    message: 'Issue reopened successfully.',
    errorCode: null,
    data: { issue }
  });
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
