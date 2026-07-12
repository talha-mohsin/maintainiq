import React from 'react';
import { Activity, Boxes, AlertTriangle, ArrowRight } from 'lucide-react';

export default function Dashboard({ stats, loading, onNavigateToTab }) {
  if (loading) {
    return (
      <div className="p-8 text-sm text-slate-500">Loading dashboard…</div>
    );
  }

  const cards = [
    {
      title: 'Active Assets',
      value: stats?.activeAssets ?? 0,
      hint: 'Tracked equipment',
      icon: Boxes,
      action: () => onNavigateToTab('assets')
    },
    {
      title: 'Open Issues',
      value: stats?.openIssues ?? 0,
      hint: 'Needs follow-up',
      icon: AlertTriangle,
      action: () => onNavigateToTab('issues')
    },
    {
      title: 'Maintenance Coverage',
      value: `${stats?.maintenanceCoverage ?? 0}%`,
      hint: 'Scheduled uptime',
      icon: Activity,
      action: () => onNavigateToTab('dashboard')
    }
  ];

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Operations Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">A streamlined view of asset health and team workload.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ title, value, hint, icon: Icon, action }) => (
          <button
            key={title}
            type="button"
            onClick={action}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Icon size={18} />
              </div>
              <ArrowRight size={16} className="text-slate-400" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-slate-500">{title}</h2>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-sm text-slate-400">{hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
