/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Trash2, Edit, ExternalLink, Calendar, MapPin, HardDrive, QrCode, ClipboardCheck, Clock, X, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle, Eye, Sparkles } from 'lucide-react';
import { api } from '../../api/api';

export default function AssetManagement({ currentUser, onNavigateToPublicAsset }) {
  // States
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals / Details
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetHistory, setAssetHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingAiInsights, setLoadingAiInsights] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Form Fields for new Asset
  const [newAsset, setNewAsset] = useState({
    assetName: '',
    assetCode: '',
    category: 'HVAC',
    location: '',
    condition: 'Excellent',
    assignedTechnician: '',
    nextService: ''
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      const filters = {
        search: search || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined
      };
      const [fetchedAssets, fetchedTechs] = await Promise.all([
        api.getAssets(filters),
        api.getTechnicians()
      ]);
      setAssets(fetchedAssets);
      setTechnicians(fetchedTechs);
    } catch (err) {
      console.error('Failed to load asset directory', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, categoryFilter, statusFilter]);

  // Load history when asset is selected
  const handleSelectAsset = async (asset) => {
    setSelectedAsset(asset);
    setLoadingHistory(true);
    setLoadingAiInsights(true);
    setAiInsights(null);
    try {
      const [history, insights] = await Promise.all([
        api.getAssetHistory(asset.id),
        api.getAssetAIInsights(asset.id)
      ]);
      setAssetHistory(history);
      setAiInsights(insights);
    } catch (err) {
      console.error('Failed to load asset history or AI insights', err);
    } finally {
      setLoadingHistory(false);
      setLoadingAiInsights(false);
    }
  };

  // Create Asset Submit
  const handleCreateAsset = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!newAsset.assetName || !newAsset.assetCode || !newAsset.location) {
      setFormError('Please fill out all required fields.');
      return;
    }

    setFormLoading(true);
    try {
      await api.createAsset(newAsset);
      setShowCreateModal(false);
      // Reset Form
      setNewAsset({
        assetName: '',
        assetCode: '',
        category: 'HVAC',
        location: '',
        condition: 'Excellent',
        assignedTechnician: '',
        nextService: ''
      });
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to create asset. Check if code already exists.');
    } finally {
      setFormLoading(false);
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  // Edit Asset Submit
  const handleEditAssetSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!editingAsset.assetName || !editingAsset.location) {
      setFormError('Please fill out required fields.');
      return;
    }
    setFormLoading(true);
    try {
      await api.updateAsset(editingAsset.id, editingAsset);
      setShowEditModal(false);
      setEditingAsset(null);
      // Reload details if it's the currently selected asset
      if (selectedAsset?.id === editingAsset.id) {
        handleSelectAsset({...selectedAsset, ...editingAsset});
      }
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to update asset.');
    } finally {
      setFormLoading(false);
    }
  };

  // Delete Asset
  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm('Are you absolutely sure you want to delete this asset? This will irreversibly erase its entire history, QR label records, and associated maintenance data.')) {
      return;
    }
    try {
      await api.deleteAsset(assetId);
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null);
      }
      loadData();
    } catch (err) {
      console.error('Failed to delete asset', err);
    }
  };

  // Copy Public Link Helper
  const handleCopyLink = (code) => {
    const fullLink = `${window.location.origin}/asset/public/${code}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Print QR Label Code Helper
  const handlePrintLabel = (asset) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label - ${asset.assetCode}</title>
          <style>
            body { font-family: 'Space Grotesk', 'Inter', sans-serif; text-align: center; padding: 40px; color: #1e293b; }
            .label-card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 30px; max-width: 320px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            .logo { font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; margin-bottom: 10px; }
            .qr-img { width: 220px; height: 220px; margin: 15px auto; }
            .asset-name { font-weight: 600; font-size: 16px; margin: 10px 0 2px 0; }
            .asset-code { font-family: monospace; font-size: 12px; color: #64748b; letter-spacing: 1px; }
            .footer { font-size: 10px; color: #94a3b8; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="logo">MaintainIQ Label</div>
            <img class="qr-img" src="${asset.qrCode}" />
            <div class="asset-name">${asset.assetName}</div>
            <div class="asset-code">${asset.assetCode}</div>
            <div class="footer">Scan to inspect or report incidents instantly</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Operational':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'Under Maintenance':
        return <AlertTriangle size={16} className="text-amber-500" />;
      default:
        return <AlertCircle size={16} className="text-rose-500" />;
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

  const getConditionColor = (cond) => {
    switch (cond) {
      case 'Excellent': return 'text-emerald-500';
      case 'Good': return 'text-sky-500';
      case 'Fair': return 'text-amber-500';
      case 'Poor': return 'text-orange-500';
      default: return 'text-rose-500';
    }
  };

  return (
    <div id="assets-directory-view" className="space-y-6 p-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* Upper header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight">Assets Directory</h1>
          <p className="text-slate-500 text-sm mt-1">Register hardware components, configure QR identity codes, and assign field engineers.</p>
        </div>
        {currentUser.role === 'Admin' && (
          <button
            id="register-asset-btn"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 shadow-md shadow-teal-500/10 transition-all self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Register Asset</span>
          </button>
        )}
      </div>

      {/* Grid: Main directory and inspector details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Directory List Column */}
        <div className={`space-y-4 ${selectedAsset ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          
          {/* Filtering Header Panel */}
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                id="search-assets"
                type="text"
                placeholder="Search by asset name, code, or location..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm outline-none focus:border-teal-400 focus:bg-white transition-all"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <select
                id="filter-category"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm outline-none focus:border-teal-400 focus:bg-white"
              >
                <option value="">All Categories</option>
                <option value="HVAC">HVAC</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Transportation">Transportation</option>
                <option value="IT">IT</option>
                <option value="General">General</option>
              </select>

              <select
                id="filter-status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm outline-none focus:border-teal-400 focus:bg-white"
              >
                <option value="">All Statuses</option>
                <option value="Operational">Operational</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Out of Service">Out of Service</option>
              </select>
            </div>
          </div>

          {/* Directory Grid */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold text-xs uppercase tracking-wider font-sans">
                    <th className="p-4 pl-6">Code / Equipment</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {assets.map(asset => {
                    const isSelected = selectedAsset?.id === asset.id;
                    return (
                      <tr
                        key={asset.id}
                        className={`hover:bg-slate-50/50 transition-colors text-sm cursor-pointer ${
                          isSelected ? 'bg-teal-500/5' : ''
                        }`}
                        onClick={() => handleSelectAsset(asset)}
                      >
                        <td className="p-4 pl-6">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs text-slate-400 font-semibold uppercase">{asset.assetCode}</span>
                            <span className="font-medium text-slate-800 mt-0.5">{asset.assetName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 font-medium">{asset.category}</td>
                        <td className="p-4 text-slate-500">
                          <div className="flex items-center space-x-1 max-w-[160px] truncate">
                            <MapPin size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate">{asset.location}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(asset.status)}`}>
                            {getStatusIcon(asset.status)}
                            {asset.status}
                          </span>
                        </td>
                        <td className="p-4 text-right pr-6" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              id={`inspect-asset-${asset.assetCode}`}
                              title="Inspect details & history"
                              onClick={() => handleSelectAsset(asset)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                              <Eye size={15} />
                            </button>
                            {currentUser.role === 'Admin' && (
                              <>
                                <button
                                  title="Edit asset"
                                  onClick={() => {
                                    setEditingAsset(asset);
                                    setShowEditModal(true);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                                >
                                  <Edit size={15} />
                                </button>
                                <button
                                  id={`delete-asset-${asset.assetCode}`}
                                  title="Remove asset"
                                  onClick={() => handleDeleteAsset(asset.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {assets.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400 text-sm">
                        No equipment matched your active query. Try broadening your terms.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Selected Asset Inspector Column */}
        {selectedAsset && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden lg:col-span-5 space-y-6 p-6 animate-slide-in sticky top-6">
            
            {/* Inspector Close & Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-400">Selected Equipment</span>
                <h2 className="font-display font-bold text-lg text-slate-900 tracking-tight mt-0.5">{selectedAsset.assetName}</h2>
                <span className="font-mono text-xs text-teal-600 font-bold tracking-wider">{selectedAsset.assetCode}</span>
              </div>
              <button
                id="close-inspector-btn"
                onClick={() => setSelectedAsset(null)}
                className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Core Details Spec List */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Monitoring Category</span>
                <span className="block font-semibold text-slate-700 text-sm">{selectedAsset.category}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium">Physical Location</span>
                <span className="block font-semibold text-slate-700 text-sm truncate" title={selectedAsset.location}>{selectedAsset.location}</span>
              </div>
              <div className="space-y-1 mt-2">
                <span className="text-slate-400 font-medium">General Condition</span>
                <span className={`block font-bold text-sm ${getConditionColor(selectedAsset.condition)}`}>
                  {selectedAsset.condition}
                </span>
              </div>
              <div className="space-y-1 mt-2">
                <span className="text-slate-400 font-medium">Assigned Technician</span>
                <span className="block font-semibold text-slate-700 text-sm">
                  {selectedAsset.assignedTechnicianName || 'Unassigned'}
                </span>
              </div>
              <div className="space-y-1 mt-2 col-span-2 border-t border-slate-200/50 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Upcoming Scheduled Service</span>
                  <span className="font-mono font-bold text-slate-700 text-xs">
                    {selectedAsset.nextService || 'No schedule set'}
                  </span>
                </div>
              </div>
            </div>

            {/* Live QR Label Panel */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">QR Labeling & Dispatch Tracking</span>
              <div className="flex items-center space-x-4 p-4 rounded-xl border border-slate-200/60 bg-white shadow-inner">
                {selectedAsset.qrCode ? (
                  <img
                    src={selectedAsset.qrCode}
                    alt="Asset QR code"
                    className="h-20 w-20 border border-slate-100 rounded-lg p-1 shrink-0 bg-slate-50"
                  />
                ) : (
                  <div className="h-20 w-20 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                    <QrCode size={24} className="text-slate-300 animate-pulse" />
                  </div>
                )}
                <div className="flex-1 space-y-2 text-xs">
                  <p className="text-slate-500 leading-normal">
                    This scannable QR label directs anyone to report issues instantly on the public tracking portal.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      id={`copy-asset-link-${selectedAsset.assetCode}`}
                      onClick={() => handleCopyLink(selectedAsset.assetCode)}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition-colors"
                    >
                      <span>{copiedCode === selectedAsset.assetCode ? 'Copied!' : 'Copy Public Link'}</span>
                    </button>
                    <button
                      id={`print-asset-label-${selectedAsset.assetCode}`}
                      onClick={() => handlePrintLabel(selectedAsset)}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 font-medium transition-colors"
                    >
                      <span>Print Label</span>
                    </button>
                    <button
                      id={`view-public-portal-${selectedAsset.assetCode}`}
                      onClick={() => onNavigateToPublicAsset(selectedAsset.assetCode)}
                      className="inline-flex items-center space-x-1 text-slate-400 hover:text-teal-600 font-semibold"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Predictive Analytics & Health Score Panel */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-teal-600 block flex items-center gap-1">
                <Sparkles size={11} className="text-teal-500 animate-pulse" /> AI Autonomous Predictive Insights
              </span>

              {loadingAiInsights ? (
                <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/20 space-y-3 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-28 bg-slate-200/50 rounded"></div>
                    <div className="h-4 w-12 bg-slate-200/50 rounded"></div>
                  </div>
                  <div className="h-3 w-full bg-slate-200/20 rounded"></div>
                  <div className="h-3 w-5/6 bg-slate-200/20 rounded"></div>
                </div>
              ) : aiInsights ? (
                <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/20 space-y-4">
                  {/* Health Score & Risk Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="relative flex items-center justify-center">
                        <span className={`text-lg font-bold font-mono ${
                          aiInsights.healthScore >= 80 ? 'text-teal-600' :
                          aiInsights.healthScore >= 50 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {aiInsights.healthScore}%
                        </span>
                      </div>
                      <div className="text-[11px]">
                        <span className="text-slate-400 block font-medium">Health Index</span>
                        <span className="font-semibold text-slate-700">Calculated Score</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase ${
                        aiInsights.riskAssessment === 'Low' ? 'bg-teal-100 text-teal-800' :
                        aiInsights.riskAssessment === 'Medium' ? 'bg-amber-100 text-amber-800' :
                        aiInsights.riskAssessment === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        Risk: {aiInsights.riskAssessment}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Operational Risk</span>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {aiInsights.preventive && (
                    <div className="space-y-2 border-t border-teal-200/40 pt-3 text-xs leading-normal">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 font-medium block">Next AI Rec Service</span>
                          <span className="font-bold text-slate-800">{aiInsights.preventive.suggestedNextMaintenance}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Replacement Alert</span>
                          <span className="font-bold text-slate-800">{aiInsights.preventive.suggestedReplacement}</span>
                        </div>
                      </div>

                      <div className="bg-white border border-teal-100 rounded-lg p-2.5 mt-2">
                        <span className="text-[9px] font-mono text-teal-600 font-semibold block uppercase">Next Inspection Protocol</span>
                        <span className="font-bold text-slate-700 text-[11px] block mt-0.5">{aiInsights.preventive.inspectionSchedule}</span>
                        <p className="text-slate-500 text-[11px] mt-1 italic leading-normal">
                          "{aiInsights.preventive.narrative}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <span className="text-xs text-slate-400">Unable to generate AI predictive insights.</span>
                </div>
              )}
            </div>

            {/* Irreversible Asset History Timeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">Irreversible Audit Timeline</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1">
                  <Clock size={10} /> Live Logs
                </span>
              </div>
              
              <div className="max-h-60 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-4">
                {loadingHistory ? (
                  <div className="text-center py-6">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-500 mx-auto"></div>
                    <span className="text-[11px] text-slate-400 block mt-2 font-medium">Synchronizing log chain...</span>
                  </div>
                ) : assetHistory.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">No diagnostic activities recorded.</p>
                ) : (
                  <div className="relative pl-4 space-y-4 border-l border-slate-200 text-xs">
                    {assetHistory.map((item, index) => (
                      <div key={item.id} className="relative space-y-1">
                        {/* Dot */}
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 ring-2 ring-slate-100" />
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{item.action}</span>
                          <span className="text-[9px] font-mono text-slate-400">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px]">
                          Performed by: <span className="font-medium text-slate-700">{item.performedBy}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 leading-normal block text-center italic bg-slate-100 py-1 rounded-lg font-mono">
                *System Audit protection active: logs cannot be altered.
              </span>
            </div>

          </div>
        )}
      </div>

      {/* MODAL: Register New Asset */}
      {showCreateModal && (
        <div id="create-asset-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-xl overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight">Register New Equipment</h3>
                <p className="text-xs text-slate-500 mt-0.5">Add an item to the tracking matrix and generate its unique label.</p>
              </div>
              <button
                id="close-create-modal"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAsset} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs border border-rose-100 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Equipment Name *</label>
                  <input
                    id="new-asset-name"
                    type="text"
                    required
                    placeholder="e.g. Server AC Unit, Basement Water Pump"
                    value={newAsset.assetName}
                    onChange={e => setNewAsset({ ...newAsset, assetName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Asset Unique Code *</label>
                  <input
                    id="new-asset-code"
                    type="text"
                    required
                    placeholder="e.g. HVAC-AC-104"
                    value={newAsset.assetCode}
                    onChange={e => setNewAsset({ ...newAsset, assetCode: e.target.value.toUpperCase().replace(/\s+/g, '-') })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm font-mono outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Monitoring Category *</label>
                  <select
                    id="new-asset-category"
                    value={newAsset.category}
                    onChange={e => setNewAsset({ ...newAsset, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="HVAC">HVAC</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Transportation">Transportation</option>
                    <option value="IT">IT</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Physical Location *</label>
                  <input
                    id="new-asset-location"
                    type="text"
                    required
                    placeholder="e.g. Block C, Roof Sector 3"
                    value={newAsset.location}
                    onChange={e => setNewAsset({ ...newAsset, location: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Initial Condition</label>
                  <select
                    id="new-asset-condition"
                    value={newAsset.condition}
                    onChange={e => setNewAsset({ ...newAsset, condition: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                    <option value="Broken">Broken</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Service Interval (Next Date)</label>
                  <input
                    id="new-asset-nextservice"
                    type="date"
                    value={newAsset.nextService}
                    onChange={e => setNewAsset({ ...newAsset, nextService: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm font-mono outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Assign Technician</label>
                  <select
                    id="new-asset-technician"
                    value={newAsset.assignedTechnician}
                    onChange={e => setNewAsset({ ...newAsset, assignedTechnician: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Unassigned</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  id="cancel-create-btn"
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="confirm-create-btn"
                  type="submit"
                  disabled={formLoading}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/10 flex items-center"
                >
                  {formLoading ? 'Registering...' : 'Register Equipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Asset */}
      {showEditModal && editingAsset && (
        <div id="edit-asset-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-100 shadow-xl overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight">Edit Equipment: {editingAsset.assetCode}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update equipment details and assignments.</p>
              </div>
              <button
                id="close-edit-modal"
                onClick={() => { setShowEditModal(false); setEditingAsset(null); }}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditAssetSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs border border-rose-100 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Equipment Name *</label>
                  <input
                    type="text"
                    required
                    value={editingAsset.assetName}
                    onChange={e => setEditingAsset({ ...editingAsset, assetName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Monitoring Category *</label>
                  <select
                    value={editingAsset.category}
                    onChange={e => setEditingAsset({ ...editingAsset, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="HVAC">HVAC</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Transportation">Transportation</option>
                    <option value="IT">IT</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Physical Location *</label>
                  <input
                    type="text"
                    required
                    value={editingAsset.location}
                    onChange={e => setEditingAsset({ ...editingAsset, location: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Condition</label>
                  <select
                    value={editingAsset.condition}
                    onChange={e => setEditingAsset({ ...editingAsset, condition: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                    <option value="Broken">Broken</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Status</label>
                  <select
                    value={editingAsset.status}
                    onChange={e => setEditingAsset({ ...editingAsset, status: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="Operational">Operational</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Out of Service">Out of Service</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Service Interval (Next Date)</label>
                  <input
                    type="date"
                    value={editingAsset.nextService || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, nextService: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm font-mono outline-none focus:border-teal-500"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Assign Technician</label>
                  <select
                    value={editingAsset.assignedTechnician || ''}
                    onChange={e => setEditingAsset({ ...editingAsset, assignedTechnician: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Unassigned</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingAsset(null); }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/10 flex items-center"
                >
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
