/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Wrench, Clock, CheckCircle2, AlertTriangle, ShieldAlert,
  Users, Plus, X, ListTodo, Hammer, Coins, Eye, CheckCircle, Sparkles,
  Trash2, Edit, AlertCircle
} from 'lucide-react';
import { api } from '../../api/api';
import { getSocket } from '../../lib/socket';

/* ─── tiny inline Toast ─────────────────────────────────────────── */
function Toast({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium min-w-[280px] max-w-sm animate-slide-in
            ${t.type === 'success' ? 'bg-emerald-600 text-white' : t.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'}`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── inline ConfirmModal ────────────────────────────────────────── */
function ConfirmModal({ isOpen, title, message, confirmLabel = 'Confirm', confirmClass = 'bg-rose-600 hover:bg-rose-500 text-white', onConfirm, onCancel, loading }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150]">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${confirmClass} disabled:opacity-60`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Create / Edit Issue Modal ──────────────────────────────────── */
function IssueFormModal({ isOpen, onClose, onSaved, assets, editingIssue }) {
  const isEdit = !!editingIssue;
  const [form, setForm] = useState({
    assetId: '',
    title: '',
    description: '',
    priority: 'Medium',
    category: 'General',
    reporter: '',
  });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);
  const [aiTriage, setAiTriage] = useState(null);

  // Populate form when editing
  useEffect(() => {
    if (editingIssue) {
      setForm({
        assetId: editingIssue.assetId || '',
        title: editingIssue.title || '',
        description: editingIssue.description || '',
        priority: editingIssue.priority || 'Medium',
        category: editingIssue.category || 'General',
        reporter: editingIssue.reporter || '',
      });
      setAiTriage(null);
      setFormError('');
    } else {
      setForm({ assetId: '', title: '', description: '', priority: 'Medium', category: 'General', reporter: '' });
      setAiTriage(null);
      setFormError('');
    }
  }, [editingIssue, isOpen]);

  if (!isOpen) return null;

  const handleAITriage = async () => {
    if (!form.description || form.description.trim().length < 5) {
      setFormError('Enter a description (5+ chars) for AI triage.');
      return;
    }
    setFormError('');
    setTriageLoading(true);
    setAiTriage(null);
    try {
      const triage = await api.triageIssueAI(form.description);
      setAiTriage(triage);
      setForm(f => ({
        ...f,
        title: triage.title || f.title,
        priority: triage.priority || f.priority,
        category: triage.category || f.category,
      }));
    } catch (err) {
      setFormError(err.message || 'AI triage failed. Fill in manually.');
    } finally {
      setTriageLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.title || !form.description || !form.reporter) {
      setFormError('Title, description, and reporter name are required.');
      return;
    }
    if (!isEdit && !form.assetId) {
      setFormError('Please select an asset.');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        // Edit: only update editable fields (title, description, priority, category)
        await api.updateIssue(editingIssue.id, {
          title: form.title,
          description: form.description,
          priority: form.priority,
          category: form.category,
        });
        onSaved('Issue updated successfully.', 'success');
      } else {
        const payload = {
          assetId: form.assetId,
          title: form.title,
          description: form.description,
          priority: form.priority,
          category: form.category,
          reporter: form.reporter,
          aiGenerated: !!aiTriage,
          possibleCauses: aiTriage?.possibleCauses || [],
          initialChecks: aiTriage?.initialChecks || [],
          safetyWarning: aiTriage?.safetyWarning || null,
        };
        await api.createIssue(payload);
        onSaved('Issue created successfully.', 'success');
      }
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to save issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{isEdit ? 'Edit Issue' : 'Create New Issue'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{isEdit ? `Editing ${editingIssue.issueNumber}` : 'File a new maintenance request'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              {formError}
            </div>
          )}

          {/* Asset selector – only on create */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Asset *</label>
              <select
                id="issue-asset-select"
                value={form.assetId}
                onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-all"
                required
              >
                <option value="">Select an asset...</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.assetName} ({a.assetCode})</option>
                ))}
              </select>
            </div>
          )}

          {/* Reporter – only on create */}
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Your Name / Reporter *</label>
              <input
                id="issue-reporter"
                type="text"
                placeholder="Full name of person reporting"
                value={form.reporter}
                onChange={e => setForm(f => ({ ...f, reporter: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-all"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Description *</label>
              <button
                type="button"
                onClick={handleAITriage}
                disabled={triageLoading}
                className="flex items-center gap-1.5 text-[11px] font-bold text-teal-600 hover:text-teal-700 disabled:opacity-50 transition-colors"
              >
                <Sparkles size={11} className="text-teal-500" />
                {triageLoading ? 'Running AI Triage...' : 'AI Auto-Triage'}
              </button>
            </div>
            <textarea
              id="issue-description"
              rows={3}
              placeholder="Describe the issue in detail..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Title *</label>
            <input
              id="issue-title"
              type="text"
              placeholder="Short descriptive title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Priority</label>
              <select
                id="issue-priority"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-all"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Category</label>
              <select
                id="issue-category"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm outline-none focus:border-teal-400 bg-slate-50 focus:bg-white transition-all"
              >
                <option>General</option>
                <option>HVAC</option>
                <option>Electrical</option>
                <option>Plumbing</option>
                <option>Structural</option>
                <option>Transportation</option>
                <option>IT</option>
              </select>
            </div>
          </div>

          {/* AI triage summary */}
          {aiTriage && (
            <div className="p-3 rounded-xl border border-teal-100 bg-teal-50/40 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-teal-700">
                <Sparkles size={11} />
                AI Triage Applied
              </div>
              {aiTriage.safetyWarning && (
                <p className="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1.5 rounded-lg">{aiTriage.safetyWarning}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              id="issue-form-submit"
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-teal-500 text-slate-950 font-bold py-2.5 text-sm hover:bg-teal-400 transition-colors disabled:opacity-60 shadow-md shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  {isEdit ? 'Saving...' : 'Creating...'}
                </>
              ) : (isEdit ? 'Save Changes' : 'Create Issue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ─── Main IssuesQueue Component ─────────────────────────────────── */
export default function IssuesQueue({ currentUser }) {
  // Lists & Filters
  const [issues, setIssues] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [assets, setAssets] = useState([]);
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
  const [evidence, setEvidence] = useState('');
  const [resError, setResError] = useState('');
  const [resLoading, setResLoading] = useState(false);

  // CRUD modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // Load Initial Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        search: search || undefined,
        priority: priorityFilter || undefined,
        status: statusFilter || undefined,
        assignedTo: assignedFilter || undefined
      };
      const [fetchedIssues, fetchedTechs, fetchedAssets] = await Promise.all([
        api.getIssues(filters),
        api.getTechnicians(),
        api.getAssets()
      ]);
      setIssues(fetchedIssues);
      setTechnicians(fetchedTechs);
      setAssets(fetchedAssets);

      // Keep selected issue up to date if open
      if (selectedIssue) {
        const updated = fetchedIssues.find(i => i.id === selectedIssue.id);
        if (updated) setSelectedIssue(updated);
      }
    } catch (err) {
      console.error('Failed to load issues queue', err);
      addToast('Failed to load issues. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, priorityFilter, statusFilter, assignedFilter, selectedIssue?.id]);

  useEffect(() => {
    loadData();
  }, [search, priorityFilter, statusFilter, assignedFilter]);

  // Real-time: refresh the queue whenever any issue is created/updated/resolved/
  // reopened/deleted elsewhere (e.g. another technician's session).
  useEffect(() => {
    const socket = getSocket();
    const events = ['issue:created', 'issue:updated', 'issue:resolved', 'issue:reopened', 'issue:deleted'];
    const handleIssueEvent = () => loadData();
    events.forEach(evt => socket.on(evt, handleIssueEvent));
    return () => {
      events.forEach(evt => socket.off(evt, handleIssueEvent));
    };
  }, [loadData]);

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
      addToast('Technician assigned successfully.', 'success');
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to assign technician.', 'error');
    }
  };

  // Handle Status Escalation
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedIssue) return;
    try {
      const updated = await api.updateIssue(selectedIssue.id, { status: newStatus });
      setSelectedIssue(updated);
      addToast(`Status updated to "${newStatus}".`, 'success');
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to update status.', 'error');
    }
  };

  // Handle Reopen (Admin only — Resolved/Closed -> Reopened)
  const handleReopenIssue = async () => {
    if (!selectedIssue) return;
    try {
      const updated = await api.reopenIssue(selectedIssue.id);
      setSelectedIssue(updated);
      addToast('Issue reopened.', 'success');
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to reopen issue.', 'error');
    }
  };

  // Delete Issue
  const handleDeleteIssue = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deleteIssue(deleteTarget.id);
      addToast(`Issue ${deleteTarget.issueNumber} deleted.`, 'success');
      if (selectedIssue?.id === deleteTarget.id) {
        setSelectedIssue(null);
        setShowResolveForm(false);
      }
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to delete issue.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle dynamic parts array
  const handleAddPartField = () => setParts([...parts, '']);
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
      const cleanParts = parts.filter(p => p.trim() !== '');
      const costNum = Number(cost) || 0;
      await api.resolveIssue(selectedIssue.id, {
        inspectionNotes,
        parts: cleanParts,
        cost: costNum,
        evidence: evidence || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300',
        summary
      });
      addToast('Issue resolved! Asset has been recommissioned.', 'success');
      setShowResolveForm(false);
      setInspectionNotes('');
      setSummary('');
      setCost('0');
      setParts(['']);
      setEvidence('');
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
      default:
        return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  const isAdmin = currentUser?.role === 'Admin';

  return (
    <div id="issues-queue-view" className="space-y-6 p-6 max-w-7xl mx-auto animate-fade-in">

      {/* Toasts */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Issue"
        message={`Are you sure you want to permanently delete issue ${deleteTarget?.issueNumber}? This action cannot be undone.`}
        confirmLabel="Delete Issue"
        onConfirm={handleDeleteIssue}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      {/* Create / Edit Modal */}
      <IssueFormModal
        isOpen={showCreateModal || !!editingIssue}
        onClose={() => { setShowCreateModal(false); setEditingIssue(null); }}
        onSaved={(msg, type) => { addToast(msg, type); loadData(); }}
        assets={assets}
        editingIssue={editingIssue}
      />

      {/* View Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight">Maintenance Issues Queue</h1>
          <p className="text-slate-500 text-sm mt-1">Track reported failures, review Gemini AI incident triage diagnostic reports, and record equipment repairs.</p>
        </div>
        <button
          id="create-issue-btn"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/20 shrink-0"
        >
          <Plus size={16} />
          New Issue
        </button>
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
                <option value="Reopened">Reopened</option>
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
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="p-4 pl-6">Issue / Source</th>
                    <th className="p-4">Equipment</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <div className="h-7 w-7 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                          <span className="text-sm">Loading issues...</span>
                        </div>
                      </td>
                    </tr>
                  ) : issues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-14 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <Wrench size={22} className="text-slate-300" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-500">No issues found</p>
                            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or create a new issue.</p>
                          </div>
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-600 text-xs font-semibold hover:bg-teal-500/20 transition-colors"
                          >
                            <Plus size={13} />
                            Create Issue
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : issues.map(issue => {
                    const isSelected = selectedIssue?.id === issue.id;
                    return (
                      <tr
                        key={issue.id}
                        className={`hover:bg-slate-50/50 transition-colors text-sm cursor-pointer ${isSelected ? 'bg-teal-500/5' : ''}`}
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
                        <td className="p-4 pr-6">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            {/* View / Inspect */}
                            <button
                              id={`inspect-issue-${issue.issueNumber}`}
                              title="Inspect"
                              onClick={() => setSelectedIssue(issue)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                            >
                              <Eye size={15} />
                            </button>
                            {/* Edit – admin or not resolved */}
                            {isAdmin && issue.status !== 'Resolved' && issue.status !== 'Closed' && (
                              <button
                                id={`edit-issue-${issue.issueNumber}`}
                                title="Edit"
                                onClick={() => setEditingIssue(issue)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                              >
                                <Edit size={15} />
                              </button>
                            )}
                            {/* Delete – admin only */}
                            {isAdmin && (
                              <button
                                id={`delete-issue-${issue.issueNumber}`}
                                title="Delete"
                                onClick={() => setDeleteTarget(issue)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Selected Issue Inspector Panel */}
        {selectedIssue && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-5 space-y-6 p-6 animate-slide-in sticky top-6">

            {/* Header */}
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
              <div className="flex items-center gap-1">
                {isAdmin && selectedIssue.status !== 'Resolved' && selectedIssue.status !== 'Closed' && (
                  <button
                    title="Edit issue"
                    onClick={() => setEditingIssue(selectedIssue)}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"
                  >
                    <Edit size={15} />
                  </button>
                )}
                {isAdmin && (
                  <button
                    title="Delete issue"
                    onClick={() => setDeleteTarget(selectedIssue)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  id="close-issue-inspector"
                  onClick={() => { setSelectedIssue(null); setShowResolveForm(false); }}
                  className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Core Details */}
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
                <p className="text-slate-600 text-xs leading-relaxed">{selectedIssue.description}</p>
              </div>
            </div>

            {/* Assignment & Progress Control (Admin) */}
            {isAdmin && ['Reported', 'Assigned', 'Inspection Started', 'Maintenance', 'Waiting Parts', 'Reopened'].includes(selectedIssue.status) && (
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

            {/* AI Triage Diagnostics */}
            {selectedIssue.aiGenerated && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-4 space-y-3">
                <div className="flex items-center space-x-2 border-b border-teal-100/50 pb-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-teal-500 text-slate-950 font-display font-black text-xs">AI</span>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Gemini AI Incident Triage</span>
                </div>
                <div className="space-y-2.5 text-xs text-slate-700">
                  {selectedIssue.possibleCauses?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide block">Probable Failure Root Causes</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600 leading-normal">
                        {selectedIssue.possibleCauses.map((cause, i) => <li key={i}>{cause}</li>)}
                      </ul>
                    </div>
                  )}
                  {selectedIssue.initialChecks?.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-teal-100/30">
                      <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wide block">Recommended Field Inspections</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600 leading-normal">
                        {selectedIssue.initialChecks.map((check, i) => <li key={i}>{check}</li>)}
                      </ul>
                    </div>
                  )}
                  {selectedIssue.safetyWarning && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 mt-2 text-[11px] leading-normal">
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

            {/* Unassigned Warning */}
            {!selectedIssue.assignedTechnician && (
              <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 flex items-center space-x-3 text-xs text-amber-800">
                <Users size={16} className="text-amber-600 shrink-0" />
                <p className="leading-normal font-medium">This incident is currently unassigned. Please assign a duty technician to launch inspections.</p>
              </div>
            )}

            {/* AI Insights Panel */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-teal-600 flex items-center gap-1">
                <Sparkles size={11} className="text-teal-500 animate-pulse" /> AI Autonomous Predictive Insights
              </span>
              {loadingIssueInsights ? (
                <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/20 space-y-3 animate-pulse">
                  <div className="h-4 w-32 bg-slate-200/50 rounded"></div>
                  <div className="h-10 w-full bg-slate-200/20 rounded"></div>
                </div>
              ) : issueInsights ? (
                <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/20 space-y-4">
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
                  {issueInsights.recommendedTechnician && (
                    <div className="border-t border-teal-200/40 pt-3">
                      <span className="text-[9px] font-mono text-teal-600 font-semibold block uppercase">AI Recommended Technician</span>
                      <div className="mt-1 bg-white p-2 rounded-lg border border-teal-100 text-[11px] font-medium text-slate-700">
                        {issueInsights.recommendedTechnician.name} <span className="text-[10px] text-slate-400">({issueInsights.recommendedTechnician.reason})</span>
                      </div>
                    </div>
                  )}
                  {issueInsights.similarIssues?.length > 0 && (
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

            {/* Technician Workflow Execution Panel */}
            {selectedIssue.assignedTechnician && ['Reported', 'Assigned', 'Inspection Started', 'Maintenance', 'Waiting Parts', 'Reopened'].includes(selectedIssue.status) && (
              <div className="pt-2 border-t border-slate-100">
                {selectedIssue.assignedTechnician === currentUser.id && (
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">Duty Technician Action Deck</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedIssue.status === 'Assigned' && (
                        <button
                          id="start-inspection-btn"
                          onClick={() => handleUpdateStatus('Inspection Started')}
                          className="flex-1 rounded-xl bg-purple-600 text-white font-semibold py-2 px-3 hover:bg-purple-500 transition-colors text-xs flex items-center justify-center space-x-2"
                        >
                          <ListTodo size={14} />
                          <span>Start Inspection</span>
                        </button>
                      )}
                      {(selectedIssue.status === 'Inspection Started' || selectedIssue.status === 'Assigned') && (
                        <button
                          id="start-maintenance-btn"
                          onClick={() => handleUpdateStatus('Maintenance')}
                          className="flex-1 rounded-xl bg-amber-600 text-white font-semibold py-2 px-3 hover:bg-amber-500 transition-colors text-xs flex items-center justify-center space-x-2"
                        >
                          <Hammer size={14} />
                          <span>Begin Repairs</span>
                        </button>
                      )}
                      {!showResolveForm ? (
                        <button
                          id="trigger-resolve-btn"
                          onClick={() => setShowResolveForm(true)}
                          className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold py-2 px-3 hover:bg-emerald-500 transition-colors text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/10"
                        >
                          <CheckCircle2 size={14} />
                          <span>Resolve Issue</span>
                        </button>
                      ) : (
                        <button
                          id="cancel-resolve-btn"
                          onClick={() => setShowResolveForm(false)}
                          className="flex-1 rounded-xl bg-slate-200 text-slate-700 font-semibold py-2 px-3 hover:bg-slate-300 transition-colors text-xs"
                        >
                          Cancel Resolution Form
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Resolution Work Log Form */}
                {showResolveForm && selectedIssue.assignedTechnician === currentUser.id && (
                  <form onSubmit={handleResolveIssue} className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4 text-xs animate-slide-in">
                    <div className="border-b border-slate-200 pb-2">
                      <h4 className="font-semibold text-slate-800">Record Service Resolution Logs</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Input diagnostic findings, parts used, and job cost to close incident.</p>
                    </div>

                    {resError && (
                      <div className="p-3 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 font-medium flex items-center gap-2">
                        <AlertCircle size={13} className="shrink-0" />
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
                              addToast('AI summary generation failed.', 'error');
                            } finally {
                              setDraftingSummary(false);
                            }
                          }}
                          className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center space-x-1"
                        >
                          <Sparkles size={10} />
                          <span>{draftingSummary ? 'Drafting...' : 'Generate AI Summary'}</span>
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

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-600">Replacement Parts Used</label>
                        <button id="add-part-btn" type="button" onClick={handleAddPartField} className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center space-x-0.5">
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
                              <button id={`remove-part-${idx}`} type="button" onClick={() => handleRemovePartField(idx)} className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600">
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
                        <label className="font-semibold text-slate-600">Select Preset Evidence</label>
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
                              addToast('Evidence image uploaded.', 'success');
                            } catch (err) {
                              addToast('Failed to upload evidence. Please try again.', 'error');
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

                    <button
                      id="submit-resolution-btn"
                      type="submit"
                      disabled={resLoading}
                      className="w-full rounded-xl bg-teal-500 text-slate-950 font-bold py-2 hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/10 flex items-center justify-center space-x-2 disabled:opacity-60"
                    >
                      {resLoading ? (
                        <>
                          <div className="h-3.5 w-3.5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                          <span>Logging repair details...</span>
                        </>
                      ) : (
                        <span>Submit Resolution & Recommission Asset</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Resolved / Closed State */}
            {['Resolved', 'Closed'].includes(selectedIssue.status) && (
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 text-xs text-emerald-800 space-y-3">
                <div className="flex items-center space-x-1.5 font-bold">
                  <CheckCircle size={15} className="text-emerald-600" />
                  <span>Issue {selectedIssue.status} successfully</span>
                </div>
                <p className="leading-normal text-[11px] text-emerald-700">
                  {selectedIssue.status === 'Resolved'
                    ? 'This repair ticket has been completed and archived. The corresponding asset has been successfully recommissioned back to Operational status in Excellent condition.'
                    : 'This ticket is closed and locked from further edits. Reopen it if the reported problem recurs.'}
                </p>
                {isAdmin && (
                  <button
                    id="reopen-issue-btn"
                    onClick={handleReopenIssue}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 text-white font-semibold py-1.5 px-3 hover:bg-emerald-600 transition-colors text-[11px]"
                  >
                    <ListTodo size={12} />
                    <span>Reopen Issue</span>
                  </button>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
