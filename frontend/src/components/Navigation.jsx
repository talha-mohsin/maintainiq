import React from 'react';
import { LayoutDashboard, Boxes, AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';

export default function Navigation({ user, activeTab, setActiveTab, onLogout }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assets', label: 'Assets', icon: Boxes },
    { id: 'issues', label: 'Issues', icon: AlertTriangle }
  ];

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500 text-lg font-black text-slate-950">
          M
        </div>
        <div>
          <p className="text-sm font-semibold">MaintainIQ</p>
          <p className="text-xs text-slate-400">Operations Console</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6">
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ShieldCheck size={16} className="text-teal-400" />
            Signed in
          </div>
          <p className="mt-2 text-sm text-slate-400">{user?.name || user?.email || 'Staff User'}</p>
        </div>

        <nav className="space-y-2">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === id
                  ? 'bg-teal-500/15 text-teal-300 shadow-inner'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="border-t border-slate-800 px-4 py-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
