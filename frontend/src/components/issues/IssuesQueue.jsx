/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Filter, Wrench, Clock, CheckCircle2, AlertTriangle, ShieldAlert, Users, Plus, X, ListTodo, Hammer, Coins, Eye, CheckCircle, Sparkles } from 'lucide-react';
import { api } from '../../api/api';

export default function IssuesQueue({ currentUser }) {
  // Lists & Filters
  const [issues, setIssues] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');

  // Selected Issue inspector / workflow
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [issueInsights, setIssueInsights] = useState(null);
  const [loadingIssueInsights, setLoadingIssueInsights] = useState(false);
  
  // Resolution Form
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [draftingSummary, setDraftingSummary] = useState(false);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [summary, setSummary] = useState('');
  const [cost, setCost] = useState('0');
  const [parts, setParts] = useState(['']);
  const [evidence, setEvidence] = useState(''); // Simulated base64 url or text description
  const [resError, setResError] = useState('');
  const [resLoading, setResLoading] = useState(false);

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      const filters = {
        search: search || undefined,
        priority: priorityFilter || undefined,
        status: statusFilter || undefined,
        assignedTo: assignedFilter || undefined
      };
      const [fetchedIssues, fetchedTechs] = await Promise.all([
        api.getIssues(filters),
        api.getTechnicians()
      ]);
      setIssues(fetchedIssues);
      setTechnicians(fetchedTechs);

      // Keep selected issue up to date if open
      if (selectedIssue) {
        const updated = fetchedIssues.find(i => i.id === selectedIssue.id);
        if (updated) setSelectedIssue(updated);
      }
    } catch (err) {
      console.error('Failed to load issues queue', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, priorityFilter, statusFilter, assignedFilter]);

  useEffect(() => {
    if (!selectedIssue) {
      setIssueInsights(null);
      return;
    }
    const fetchInsights = async () => {
      setLoadingIssueInsights(true);
      setIssueInsights(null);
      try {
        const insights = await api.getIssueAIInsights(selectedIssue.id);
        setIssueInsights(insights);
      } catch (err) {
        console.error('Failed to fetch issue AI insights', err);
      } finally {
        setLoadingIssueInsights(false);
      }
    };
    fetchInsights();
  }, [selectedIssue?.id]);

  // Handle Technician Assignment (Admin only)
  const handleAssignTechnician = async (techId) => {
    if (!selectedIssue) return;
    try {
      const updated = await api.updateIssue(selectedIssue.id, {
        assignedTechnician: techId || null
      });
      setSelectedIssue(updated);
      loadData();
    } catch (err) {
      console.error('Failed to assign technician', err);
    }
  };

  // Handle Status Escalation (Inspection, Maintenance)
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedIssue) return;
    try {
      const updated = await api.updateIssue(selectedIssue.id, {
        status: newStatus
      });
      setSelectedIssue(updated);
      loadData();
    } catch (err) {
      console.error('Failed to escalate status', err);
    }
  };

  // Handle dynamic parts array
  const handleAddPartField = () => {
    setParts([...parts, '']);
  };

  const handlePartChange = (index, val) => {
    const updated = [...parts];
    updated[index] = val;
    setParts(updated);
  };

  const handleRemovePartField = (index) => {
    if (parts.length === 1) return;
    setParts(parts.filter((_, i) => i !== index));
  };

  // Submit Issue Resolution
  const handleResolveIssue = async (e) => {
    e.preventDefault();
    setResError('');
    if (!inspectionNotes || !summary) {
      setResError('Inspection notes and repair summary are required.');
      return;
    }

    setResLoading(true);
    try {
      // Filter empty parts
      const cleanParts = parts.filter(p => p.trim() !== '');
      const costNum = Number(cost) || 0;

      await api.resolveIssue(selectedIssue.id, {
        inspectionNotes,
        parts: cleanParts,
        cost: costNum,
        evidence: evidence || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300', // standard high-fidelity verification preset
        summary
      });

      setShowResolveForm(false);
      setInspectionNotes('');
      setSummary('');
      setCost('0');
      setParts(['']);
      setEvidence('');

      // Refresh selected issue info
      loadData();
    } catch (err) {
      setResError(err.message || 'Failed to submit resolution logs.');
    } finally {
      setResLoading(false);
    }
  };

  const getPriorityBadge = (prio) => {
    switch (prio) {
      case 'Critical': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'High': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'Medium': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      default: return 'bg-teal-50 text-teal-700 border-teal-100';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Reported':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Assigned':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Inspection Started':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      default: // Maintenance, Waiting Parts, Reopened
        return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  return (
    <div id="issues-queue-view" className="space-y-6 p-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* View Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight">Maintenance Issues Queue</h1>
        <p className="text-slate-500 text-sm mt-1">Track reported failures, review Gemini AI incident triage diagnostic reports, and record equipment repairs.</p>
      </div>

      {/* Grid: Main Table vs Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Issues Table Column */}
        <div className={`space-y-4 ${selectedIssue ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          
          {/* Filters Bar */}
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="search-issues"
                type="text"
                placeholder="Search by issue #, title, asset name, or keywords..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm outline-none focus:border-teal-400 focus:bg-white transition-all"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <select
                id="filter-priority"
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm outline-none focus:border-teal-400 focus:bg-white"
              >
                <option value="">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <select
                id="filter-issue-status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm outline-none focus:border-teal-400 focus:bg-white"
              >
                <option value="">All Statuses</option>
                <option value="Reported">Reported</option>
                <option value="Assigned">Assigned</option>
                <option value="Inspection Started">Inspection Started</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Waiting Parts">Waiting Parts</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              <select
                id="filter-assigned"
                value={assignedFilter}
                onChange={e => setAssignedFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm outline-none focus:border-teal-400 focus:bg-white"
              >
                <option value="">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Issue Rows Container */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-xs uppercase tracking-wider font-sans">
                    <th className="p-4 pl-6">Issue / Source</th>
                    <th className="p-4">Equipment</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {issues.map(issue => {
                    const isSelected = selectedIssue?.id === issue.id;
                    return (
                      <tr
                        key={issue.id}
                        className={`hover:bg-slate-50/50 transition-colors text-sm cursor-pointer ${
                          isSelected ? 'bg-teal-500/5' : ''
                        }`}
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <td className="p-4 pl-6">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs text-slate-400 font-bold">{issue.issueNumber}</span>
                              {issue.aiGenerated && (
                                <span className="inline-flex items-center text-[9px] font-semibold text-teal-600 bg-teal-50 px-1 rounded uppercase font-mono">AI Triaged</span>
                              )}
                            </div>
                            <span className="font-medium text-slate-800 mt-0.5 max-w-[200px] truncate" title={issue.title}>{issue.title}</span>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-slate-600">{issue.assetName}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getPriorityBadge(issue.priority)}`}>
                            {issue.priority}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(issue.status)}`}>
                            {issue.status}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <button
                            id={`inspect-issue-${issue.issueNumber}`}
                            onClick={() => setSelectedIssue(issue)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {issues.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 text-sm">
                        No reported incidents matched your active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Selected Issue Inspector Panel */}
        {selectedIssue && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-5 space-y-6 p-6 animate-slide-in sticky top-6">
            
            {/* Header / Info bar */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-400">Incident Report</span>
                <h2 className="font-display font-bold text-lg text-slate-900 tracking-tight mt-0.5">{selectedIssue.title}</h2>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="font-mono text-xs text-indigo-600 font-bold">{selectedIssue.issueNumber}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-medium">For {selectedIssue.assetName}</span>
                </div>
              </div>
              <button
                id="close-issue-inspector"
                onClick={() => {
                  setSelectedIssue(null);
                  setShowResolveForm(false);
                }}
                className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Core Details Spec List */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(selectedIssue.status)}`}>
                  {selectedIssue.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Priority Rating</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getPriorityBadge(selectedIssue.priority)}`}>
                  {selectedIssue.priority}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Original Reporter</span>
                <span className="font-semibold text-slate-700 text-right">{selectedIssue.reporter}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Date Reported</span>
                <span className="font-mono font-medium text-slate-500">{new Date(selectedIssue.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div className="pt-2 border-t border-slate-200/50 mt-2">
                <span className="text-slate-400 font-medium block mb-1">User Problem Description</span>
                <p className="text-slate-600 text-xs leading-relaxed font-sans">{selectedIssue.description}</p>
              </div>
            </div>

            {/* Assignment & Progress Control Module (Admin only or editable) */}
            {currentUser.role === 'Admin' && ['Reported', 'Assigned', 'Inspection Started', 'Maintenance', 'Waiting Parts', 'Reopened'].includes(selectedIssue.status) && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">Duty Assignment & Control</label>
                <div className="flex gap-3">
                  <select
                    id="assign-tech-select"
                    value={selectedIssue.assignedTechnician || ''}
                    onChange={e => handleAssignTechnician(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 py-1.5 px-3 text-xs outline-none focus:border-teal-500"
                  >
                    <option value="">Unassigned</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <select
                    id="escalate-status-select"
                    value={selectedIssue.status}
                    onChange={e => handleUpdateStatus(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 py-1.5 px-3 text-xs outline-none focus:border-teal-500"
                  >
                    <option value="Reported">Reported</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Inspection Started">Inspection Started</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Waiting Parts">Waiting Parts</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>
            )}

            {/* AI INCIDENT TRIAGE DIAGNOSTICS */}
            {selectedIssue.aiGenerated && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-4 space-y-3">
                <div className="flex items-center space-x-2 border-b border-teal-100/50 pb-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-teal-500 text-slate-950 font-display font-black text-xs">AI</span>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Gemini AI Incident Triage</span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700">
                  {selectedIssue.possibleCauses && selectedIssue.possibleCauses.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide block">Probable Failure Root Causes</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600 font-sans leading-normal">
                        {selectedIssue.possibleCauses.map((cause, i) => <li key={i}>{cause}</li>)}
                      </ul>
                    </div>
                  )}

                  {selectedIssue.initialChecks && selectedIssue.initialChecks.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-teal-100/30">
                      <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide block">Recommended Field Inspections</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600 font-sans leading-normal">
                        {selectedIssue.initialChecks.map((check, i) => <li key={i}>{check}</li>)}
                      </ul>
                    </div>
                  )}

                  {selectedIssue.safetyWarning && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 mt-2 text-[11px] leading-normal font-sans">
                      <div className="flex items-center space-x-1.5 font-bold mb-1 text-rose-900 uppercase tracking-wide text-[9px]">
                        <ShieldAlert size={12} className="text-rose-600" />
                        <span>Critical Field Safety Alert</span>
                      </div>
                      {selectedIssue.safetyWarning}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assignee Details Banner */}
            {!selectedIssue.assignedTechnician && (
              <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 flex items-center space-x-3 text-xs text-amber-800">
                <Users size={16} className="text-amber-600 shrink-0" />
                <p className="leading-normal font-medium">This incident is currently unassigned. Please assign a duty technician to launch inspections.</p>
              </div>
            )}

            {/* AI INCIDENT INSIGHTS PANEL */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-teal-600 block flex items-center gap-1">
                <Sparkles size={11} className="text-teal-500 animate-pulse" /> AI Autonomous Predictive Insights
              </span>
              {loadingIssueInsights ? (
                <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/20 space-y-3 animate-pulse">
                  <div className="h-4 w-32 bg-slate-200/50 rounded"></div>
                  <div className="h-10 w-full bg-slate-200/20 rounded"></div>
                </div>
              ) : issueInsights ? (
                <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/20 space-y-4">
                  {/* Estimates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-2 rounded-lg border border-teal-100">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">Est. Repair Time</span>
                      <span className="text-xs font-bold text-slate-800">{issueInsights.estimates?.estimatedTimeMinutes} mins</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-teal-100">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">Est. Cost Range</span>
                      <span className="text-xs font-bold text-slate-800">${issueInsights.estimates?.estimatedCostMin} - {issueInsights.estimates?.estimatedCostMax}</span>
                    </div>
                  </div>

                  {/* Technician Recommendation */}
                  {issueInsights.recommendedTechnician && (
                    <div className="border-t border-teal-200/40 pt-3">
                      <span className="text-[9px] font-mono text-teal-600 font-semibold block uppercase">AI Recommended Technician</span>
                      <div className="mt-1 bg-white p-2 rounded-lg border border-teal-100 text-[11px] font-medium text-slate-700">
                        {issueInsights.recommendedTechnician.name} <span className="text-[10px] text-slate-400">({issueInsights.recommendedTechnician.reason})</span>
                      </div>
                    </div>
                  )}

                  {/* Similar Issues */}
                  {issueInsights.similarIssues && issueInsights.similarIssues.length > 0 && (
                    <div className="border-t border-teal-200/40 pt-3">
                      <span className="text-[9px] font-mono text-teal-600 font-semibold block uppercase">Similar Historical Issues</span>
                      <ul className="mt-2 space-y-1.5">
                        {issueInsights.similarIssues.map((si, i) => (
                          <li key={i} className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100">
                            <span className="font-bold text-slate-800">#{si.issueNumber}:</span> {si.recommendedAction}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-xs text-slate-400">Unable to generate AI insights for this issue.</span>
                </div>
              )}
            </div>

            {/* TECHNICIAN WORKFLOW EXECUTION PANEL */}
            {selectedIssue.assignedTechnician && ['Reported', 'Assigned', 'Inspection Started', 'Maintenance', 'Waiting Parts', 'Reopened'].includes(selectedIssue.status) && (
              <div className="pt-2 border-t border-slate-100">
                
                {/* Active progress tracker */}
                {selectedIssue.assignedTechnician === currentUser.id && (
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">Duty Technician Action Deck</span>
                    
                    <div className="flex flex-wrap gap-2">
                      {selectedIssue.status === 'Assigned' && (
                        <button
                          id="start-inspection-btn"
                          onClick={() => handleUpdateStatus('Inspection Started')}
                          className="flex-1 rounded-xl bg-purple-600 text-white font-semibold py-2 px-3 hover:bg-purple-500 transition-colors text-xs text-center flex items-center justify-center space-x-2"
                        >
                          <ListTodo size={14} />
                          <span>Start Inspection</span>
                        </button>
                      )}

                      {(selectedIssue.status === 'Inspection Started' || selectedIssue.status === 'Assigned') && (
                        <button
                          id="start-maintenance-btn"
                          onClick={() => handleUpdateStatus('Maintenance')}
                          className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-2 px-3 hover:bg-amber-500 transition-colors text-xs text-center flex items-center justify-center space-x-2"
                        >
                          <Hammer size={14} />
                          <span>Begin Repairs</span>
                        </button>
                      )}

                      {!showResolveForm ? (
                        <button
                          id="trigger-resolve-btn"
                          onClick={() => setShowResolveForm(true)}
                          className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold py-2 px-3 hover:bg-emerald-500 transition-colors text-xs text-center flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/10"
                        >
                          <CheckCircle2 size={14} />
                          <span>Resolve Issue</span>
                        </button>
                      ) : (
                        <button
                          id="cancel-resolve-btn"
                          onClick={() => setShowResolveForm(false)}
                          className="flex-1 rounded-xl bg-slate-200 text-slate-700 font-semibold py-2 px-3 hover:bg-slate-300 transition-colors text-xs text-center"
                        >
                          Cancel Resolution form
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* RESOLUTION WORK LOG FORM */}
                {showResolveForm && selectedIssue.assignedTechnician === currentUser.id && (
                  <form onSubmit={handleResolveIssue} className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4 text-xs animate-slide-in">
                    <div className="border-b border-slate-200 pb-2">
                      <h4 className="font-semibold text-slate-800">Record Service Resolution Logs</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Input diagnostic findings, parts used, and job cost to close incident.</p>
                    </div>

                    {resError && (
                      <div className="p-3 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 font-medium">
                        {resError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-600">Inspection & Findings Notes *</label>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!inspectionNotes) return;
                            setDraftingSummary(true);
                            try {
                              const draft = await api.generateAIDraftSummary(inspectionNotes);
                              setSummary(draft);
                            } catch (err) {
                              console.error("AI Summary generation failed", err);
                            } finally {
                              setDraftingSummary(false);
                            }
                          }}
                          className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center space-x-1"
                        >
                          <Sparkles size={10} /> <span>{draftingSummary ? 'Drafting...' : 'Generate AI Summary'}</span>
                        </button>
                      </div>
                      <textarea
                        id="resolve-inspection-notes"
                        required
                        rows={2}
                        placeholder="Detail observations during diagnosis..."
                        value={inspectionNotes}
                        onChange={e => setInspectionNotes(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 py-1.5 px-3 bg-white outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-600">Repair Summary & Actions Taken *</label>
                      <textarea
                        id="resolve-repair-summary"
                        required
                        rows={2}
                        placeholder="Detail the technical repair completed..."
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 py-1.5 px-3 bg-white outline-none focus:border-teal-500"
                      />
                    </div>

                    {/* Dynamic Parts Table */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-600">Replacement Parts Used</label>
                        <button
                          id="add-part-btn"
                          type="button"
                          onClick={handleAddPartField}
                          className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center space-x-0.5"
                        >
                          <Plus size={10} /> <span>Add Part</span>
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        {parts.map((part, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              id={`part-${idx}`}
                              type="text"
                              placeholder="e.g. Capacitor 45uF, Copper Gasket"
                              value={part}
                              onChange={e => handlePartChange(idx, e.target.value)}
                              className="flex-1 rounded-lg border border-slate-200 py-1 px-2 bg-white outline-none focus:border-teal-500"
                            />
                            {parts.length > 1 && (
                              <button
                                id={`remove-part-${idx}`}
                                type="button"
                                onClick={() => handleRemovePartField(idx)}
                                className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="font-semibold text-slate-600 flex items-center gap-1">
                          <Coins size={13} className="text-slate-400" />
                          <span>Total Repair Cost ($)</span>
                        </label>
                        <input
                          id="resolve-cost"
                          type="number"
                          placeholder="0.00"
                          value={cost}
                          onChange={e => setCost(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 py-1 px-2 bg-white font-mono outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="font-semibold text-slate-600">Select Preset Evidence (Optional)</label>
                        <select
                          id="resolve-evidence-select"
                          value={evidence}
                          onChange={e => setEvidence(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 py-1 px-2 bg-white outline-none focus:border-teal-500"
                        >
                          <option value="">Visual Verification Preset</option>
                          <option value="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=300">Clean repair housing</option>
                          <option value="https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300">Calibrated diagnostic screen</option>
                          <option value="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=300">Cleared valve/pipeline</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 col-span-2">
                        <label className="font-semibold text-slate-600">Or Upload Custom Evidence (Cloudinary)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setResLoading(true);
                            try {
                              const result = await api.uploadFile(file);
                              setEvidence(result.url);
                            } catch (err) {
                              console.error("Upload error:", err);
                              alert("Failed to upload evidence. Please try again.");
                            } finally {
                              setResLoading(false);
                            }
                          }}
                          className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-500/10 file:text-teal-600 hover:file:bg-teal-500/20 cursor-pointer"
                        />
                        {evidence && (
                          <div className="mt-2 relative inline-block">
                            <span className="text-[10px] text-slate-500 block mb-1 font-medium">Selected Evidence Image:</span>
                            <img src={evidence} alt="Evidence Preview" className="h-20 w-20 object-cover rounded-lg border border-slate-200" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resolution submit button */}
                    <button
                      id="submit-resolution-btn"
                      type="submit"
                      disabled={resLoading}
                      className="w-full rounded-xl bg-teal-500 text-slate-950 font-bold py-2 hover:bg-teal-400 transition-colors text-center shadow-md shadow-teal-500/10 flex items-center justify-center space-x-2"
                    >
                      <span>{resLoading ? 'Logging repair details...' : 'Submit Resolution & Recommission Asset'}</span>
                    </button>
                  </form>
                )}

              </div>
            )}

            {/* Resolved History / Details */}
            {selectedIssue.status === 'Resolved' && (
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 text-xs text-emerald-800 space-y-2">
                <div className="flex items-center space-x-1.5 font-bold">
                  <CheckCircle size={15} className="text-emerald-600" />
                  <span>Issue Resolved successfully</span>
                </div>
                <p className="leading-normal text-[11px] text-emerald-700">This repair ticket has been completed and archived. The corresponding asset has been successfully recommissioned back to Operational status in Excellent condition.</p>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
