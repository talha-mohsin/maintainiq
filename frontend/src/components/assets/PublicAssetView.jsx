/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, MapPin, Sparkles, AlertTriangle, CheckCircle2, AlertCircle, Clock, ShieldAlert, ArrowLeft, ArrowRight, X, ChevronRight, HelpCircle } from 'lucide-react';
import { api } from '../../api/api';

export default function PublicAssetView({ assetCode, onGoBackToLogin }) {
  // Asset info
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reporting / Triage State
  const [showReportForm, setShowReportForm] = useState(false);
  const [reporterName, setReporterName] = useState('');
  const [description, setDescription] = useState('');
  
  // AI Triage
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState('');
  const [aiTriage, setAiTriage] = useState(null);
  const [editTriageMode, setEditTriageMode] = useState(false);
  
  // Submission
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [reportedIssueNumber, setReportedIssueNumber] = useState('');
  
  // Image Evidence State
  const [uploadedImage, setUploadedImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load public asset details on startup
  const loadAssetDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAssetPublic(assetCode);
      setAsset(res.asset);
      setHistory(res.history);
    } catch (err) {
      setError(err.message || 'The QR code code is invalid, retired, or doesn\'t exist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssetDetails();
  }, [assetCode]);

  // AI Triage click
  const handleAITriage = async () => {
    if (!description || description.trim().length < 5) {
      setTriageError('Please write a detailed description of the issue (at least 5 characters) to help the AI triage.');
      return;
    }
    setTriageError('');
    setTriageLoading(true);
    setAiTriage(null);
    try {
      const triage = await api.triageIssueAI(description);
      setAiTriage(triage);
    } catch (err) {
      setTriageError(err.message || 'Failed to trigger AI triage. Please enter details manually.');
    } finally {
      setTriageLoading(false);
    }
  };

  // Submit Issue
  const handleSubmitIssue = async (e) => {
    e.preventDefault();
    if (!reporterName || !description) {
      setError('Please provide your name and a description of the issue.');
      return;
    }

    setSubmitLoading(true);
    try {
      const issueData = {
        assetId: asset.id,
        reporter: reporterName,
        description,
        title: aiTriage ? aiTriage.title : 'Incident Ticket',
        category: aiTriage ? aiTriage.category : asset.category || 'General',
        priority: aiTriage ? aiTriage.priority : 'Medium',
        possibleCauses: aiTriage ? aiTriage.possibleCauses : [],
        initialChecks: aiTriage ? aiTriage.initialChecks : [],
        safetyWarning: aiTriage ? aiTriage.safetyWarning : null,
        aiGenerated: !!aiTriage,
        imageEvidence: uploadedImage || null
      };

      const issue = await api.createIssue(issueData);
      setReportedIssueNumber(issue.issueNumber);
      setSubmitSuccess(true);
      setShowReportForm(false);
      setUploadedImage('');
      // Reload asset status to reflect Under Maintenance if auto-escalated
      loadAssetDetails();
    } catch (err) {
      setError(err.message || 'Failed to file your issue. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Operational':
        return <CheckCircle2 size={18} className="text-emerald-500" />;
      case 'Under Maintenance':
        return <AlertTriangle size={18} className="text-amber-500" />;
      default:
        return <AlertCircle size={18} className="text-rose-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Operational':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Under Maintenance':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-300">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-teal-500"></div>
          <p className="text-slate-400 font-medium text-sm animate-pulse">Accessing public tracking matrix...</p>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6 shadow-xl">
          <div className="h-14 w-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <X size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="font-display font-bold text-xl text-white tracking-tight">Invalid QR Code Code</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{error || 'This equipment code has been retired or registered incorrectly. Please scan a valid label.'}</p>
          </div>
          <button
            onClick={onGoBackToLogin}
            className="inline-flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-750 transition-all"
          >
            <ArrowLeft size={16} />
            <span>Go to Staff Login</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      
      {/* Upper Navigation Bar */}
      <header className="flex h-16 items-center justify-between border-b border-slate-800 px-6 bg-slate-900/60 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-teal-500 text-slate-900 font-display font-black text-base">M</div>
          <span className="font-display font-bold text-base tracking-tight text-white">MaintainIQ Public Portal</span>
        </div>
        <button
          onClick={onGoBackToLogin}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={12} />
          <span>Staff Login</span>
        </button>
      </header>

      {/* Main Core View Area */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        
        {/* Success Banner */}
        {submitSuccess && (
          <div className="bg-emerald-950/40 border border-emerald-800 rounded-2xl p-6 text-center space-y-3 animate-zoom-in">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display font-bold text-lg text-emerald-300">Incident Filed Successfully</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Your incident ticket has been assigned ID <span className="font-mono font-bold text-teal-400">{reportedIssueNumber}</span>.
              </p>
              <p className="text-slate-400 text-[11px]">Field engineers have been alerted and auto-escalation protocols have triggered.</p>
            </div>
            <button
              onClick={() => setSubmitSuccess(false)}
              className="inline-flex px-4 py-1.5 rounded-lg bg-emerald-800 text-emerald-100 hover:bg-emerald-700 font-semibold text-xs transition-colors"
            >
              Filing checklist
            </button>
          </div>
        )}

        {/* Equipment Status Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-teal-400">Public Asset Status</span>
              <h1 className="font-display font-bold text-2xl text-white tracking-tight mt-1">{asset.assetName}</h1>
              <span className="font-mono text-xs text-slate-400 tracking-wider block mt-1">{asset.assetCode}</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${getStatusBadge(asset.status)} self-start md:self-auto`}>
              {getStatusIcon(asset.status)}
              {asset.status}
            </span>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850 space-y-1">
              <span className="text-slate-400 font-medium">Category</span>
              <span className="block font-semibold text-white text-sm">{asset.category}</span>
            </div>
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850 space-y-1">
              <span className="text-slate-400 font-medium">Physical Location</span>
              <span className="block font-semibold text-white text-sm truncate" title={asset.location}>
                {asset.location}
              </span>
            </div>
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850 space-y-1 col-span-2 md:col-span-1">
              <span className="text-slate-400 font-medium">Operating Condition</span>
              <span className="block font-semibold text-white text-sm">{asset.condition}</span>
            </div>
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850 space-y-1 col-span-2">
              <div className="flex justify-between items-center h-full">
                <div>
                  <span className="text-slate-400 font-medium">Last Inspection</span>
                  <span className="block font-semibold text-white text-sm">{asset.lastService || 'Awaiting initial service'}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-medium">Next Scheduled</span>
                  <span className="block font-mono text-teal-400 font-bold text-xs">{asset.nextService || 'Quarterly Cycle'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Urgent "Report Failure" Button */}
          {!showReportForm && !submitSuccess && (
            <button
              id="public-report-incident-btn"
              onClick={() => {
                setShowReportForm(true);
                setAiTriage(null);
                setReporterName('');
                setDescription('');
              }}
              className="w-full inline-flex items-center justify-center space-x-2.5 rounded-xl bg-teal-500 py-3 px-4 font-bold text-slate-950 hover:bg-teal-400 shadow-lg shadow-teal-500/15 transition-all text-sm"
            >
              <AlertTriangle size={18} />
              <span>Report Equipment Malfunction / Issue</span>
            </button>
          )}
        </div>

        {/* REPORT INCIDENT FORM */}
        {showReportForm && (
          <form onSubmit={handleSubmitIssue} className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4 animate-slide-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-white">Report Equipment Malfunction</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Alert technician dispatch. AI Triage is available for instant diagnostics.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Your Name (Reporter) *</label>
                <input
                  id="public-reporter-name"
                  type="text"
                  required
                  placeholder="e.g. David Finch, Jane Cooper"
                  value={reporterName}
                  onChange={e => setReporterName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">What is the problem? Describe what you see/hear *</label>
                <textarea
                  id="public-description"
                  required
                  rows={3}
                  placeholder="e.g. AC unit is leaking water directly onto Rack B and making a loud vibrating grinding noise..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-white outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Upload Photo Evidence (Optional)</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingImage(true);
                      try {
                        const result = await api.uploadFile(file);
                        setUploadedImage(result.url);
                      } catch (err) {
                        console.error("Upload error:", err);
                        alert("Failed to upload image. Please try again.");
                      } finally {
                        setUploadingImage(false);
                      }
                    }}
                    className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-500/10 file:text-teal-400 hover:file:bg-teal-500/20 cursor-pointer"
                  />
                  {uploadingImage && <span className="text-[10px] text-teal-400 animate-pulse">Uploading...</span>}
                </div>
                {uploadedImage && (
                  <div className="mt-2 relative inline-block">
                    <img src={uploadedImage} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-slate-800" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setUploadedImage('')}
                      className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Gemini AI Issue Triage Deck */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">Smart AI Assistant</span>
                  {!aiTriage && !triageLoading && (
                    <button
                      id="ai-triage-trigger"
                      type="button"
                      onClick={handleAITriage}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 font-bold transition-all"
                    >
                      <Sparkles size={12} />
                      <span>Trigger AI Triage</span>
                    </button>
                  )}
                </div>

                {triageError && (
                  <p className="text-xs text-rose-400 bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/30">{triageError}</p>
                )}

                {triageLoading && (
                  <div className="text-center py-4 space-y-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500 mx-auto"></div>
                    <p className="text-[10px] text-slate-400 font-medium animate-pulse">Gemini AI is analyzing failure description and checking hazards...</p>
                  </div>
                )}

                {aiTriage && (
                  <div className="space-y-3 border-t border-slate-850 pt-3 animate-fade-in">
                    
                    {/* Title & priority summary */}
                    <div className="p-3 rounded-lg border border-teal-800/30 bg-teal-950/10 flex items-start justify-between">
                      <div className="space-y-1 max-w-[70%]">
                        <span className="text-[9px] uppercase tracking-wide font-bold text-teal-400 block font-mono">Suggested Ticket Title</span>
                        {editTriageMode ? (
                          <input
                            id="edit-triage-title"
                            type="text"
                            value={aiTriage.title}
                            onChange={e => setAiTriage({ ...aiTriage, title: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white text-xs"
                          />
                        ) : (
                          <span className="font-semibold text-teal-300 font-sans">{aiTriage.title}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wide font-bold text-slate-400 block font-mono">Severity Priority</span>
                        {editTriageMode ? (
                          <select
                            id="edit-triage-priority"
                            value={aiTriage.priority}
                            onChange={e => setAiTriage({ ...aiTriage, priority: e.target.value })}
                            className="bg-slate-900 border border-slate-700 rounded text-xs text-white"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                        ) : (
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 uppercase ${
                            aiTriage.priority === 'Critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>{aiTriage.priority}</span>
                        )}
                      </div>
                    </div>

                    {/* Causes list */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-semibold block">Probable Causes</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-300 leading-normal">
                        {aiTriage.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>

                    {/* Safety Warnings block */}
                    {aiTriage.safetyWarning && (
                      <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-300 text-[11px] leading-normal font-sans">
                        <div className="flex items-center space-x-1.5 font-bold mb-1 text-rose-400 uppercase tracking-wide text-[9px]">
                          <ShieldAlert size={12} className="text-rose-500" />
                          <span>AI Safety Warning</span>
                        </div>
                        {aiTriage.safetyWarning}
                      </div>
                    )}

                    {/* Accept / Reject actions */}
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        id="triage-edit-toggle"
                        type="button"
                        onClick={() => setEditTriageMode(!editTriageMode)}
                        className="text-[10px] text-slate-400 hover:text-white underline"
                      >
                        {editTriageMode ? 'Done Editing' : 'Adjust Triage Info'}
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        id="triage-discard-btn"
                        type="button"
                        onClick={() => {
                          setAiTriage(null);
                          setEditTriageMode(false);
                        }}
                        className="text-[10px] text-rose-400 hover:text-rose-300 underline"
                      >
                        Discard AI Suggestions
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </div>

            {/* Submit Action Block */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                id="public-cancel-btn"
                type="button"
                onClick={() => setShowReportForm(false)}
                className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-850 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                id="public-submit-btn"
                type="submit"
                disabled={submitLoading}
                className="rounded-lg bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/10 flex items-center justify-center space-x-1.5"
              >
                <span>{submitLoading ? 'Filing order...' : 'Accept & File Incident Ticket'}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </form>
        )}

        {/* Audit Timeline details */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-base text-white">Public Activity History</h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold flex items-center gap-1">
              <Clock size={11} className="text-slate-600" /> Non-confidential
            </span>
          </div>

          <div className="relative pl-4 space-y-4 border-l border-slate-800 text-xs">
            {history.map((h, i) => (
              <div key={h.id} className="relative space-y-1">
                {/* Dot */}
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border-2 border-slate-900 bg-slate-600 ring-2 ring-slate-800" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{h.action}</span>
                  <span className="text-[9px] font-mono text-slate-500">
                    {new Date(h.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Authorized by: <span className="font-semibold text-slate-300">{h.performedBy}</span>
                </p>
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-slate-500 text-xs py-4 text-center">No maintenance activities reported for this unit.</p>
            )}
          </div>
        </div>

      </main>

    </div>
  );
}
