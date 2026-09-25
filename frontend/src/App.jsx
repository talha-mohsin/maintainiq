/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import { connectSocket, disconnectSocket } from './lib/socket';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import AssetManagement from './components/AssetManagement';
import IssuesQueue from './components/IssuesQueue';
import PublicAssetView from './components/PublicAssetView';
import { ShieldCheck, LogIn, Key, Users, Info, Sparkles, UserPlus } from 'lucide-react';

export default function App() {
  // Authentication & Routing
  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Public Routing
  const [publicAssetCode, setPublicAssetCode] = useState('');

  // Active Tab in Workspace
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dashboard Analytics Cache
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Login / Register Form States
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Parse Initial Path Routing on Startup
  useEffect(() => {
    // Register global handler to intercept expired sessions (401 Unauthorized)
    api.onUnauthorized(() => {
      setCurrentUser(null);
      setView('login');
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    });

    const checkPathnameAndAuth = async () => {
      setAuthLoading(true);
      
      const path = window.location.pathname;
      const publicAssetMatch = path.match(/^\/asset\/public\/([a-zA-Z0-9_-]+)/);
      
      if (publicAssetMatch) {
        // Deep-link to public tracking label
        setPublicAssetCode(publicAssetMatch[1]);
        setView('public');
        setAuthLoading(false);
        return;
      }

      // Check current session
      try {
        const user = await api.getMe();
        setCurrentUser(user);
        setView('workspace');
      } catch (err) {
        // Not logged in or invalid session
        setView('login');
      } finally {
        setAuthLoading(false);
      }
    };

    checkPathnameAndAuth();
  }, []);

  // Fetch Dashboard Stats
  const loadDashboardStats = async () => {
    if (view !== 'workspace' || !currentUser) return;
    setStatsLoading(true);
    try {
      const statsData = await api.getDashboardStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardStats();
  }, [view, activeTab, currentUser]);

  // Real-time: live dashboard refresh on issue create/update/resolve/reopen/delete
  useEffect(() => {
    if (view !== 'workspace' || !currentUser) return;

    const socket = connectSocket();
    const handleDashboardUpdate = () => loadDashboardStats();
    socket.on('dashboard:update', handleDashboardUpdate);

    return () => {
      socket.off('dashboard:update', handleDashboardUpdate);
      disconnectSocket();
    };
  }, [view, currentUser]);

  // Handle Login submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!email || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setLoginLoading(true);
    try {
      const user = await api.login(email, password);
      setCurrentUser(user);
      setView('workspace');
    } catch (err) {
      setLoginError(err.message || 'Invalid login credentials. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Register submit — always provisions a Technician account
  // (Admin accounts must be created by an existing Admin, not self-service)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!name || !email || !password) {
      setLoginError('Please fill in name, email, and password.');
      return;
    }
    if (password.length < 6) {
      setLoginError('Password must be at least 6 characters.');
      return;
    }

    setLoginLoading(true);
    try {
      const user = await api.register(name, email, password);
      setCurrentUser(user);
      setView('workspace');
    } catch (err) {
      setLoginError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setLoginError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  // Quick fill demo credentials helper
  const handleQuickLogin = (role) => {
    if (role === 'Admin') {
      setEmail('admin@maintainiq.com');
      setPassword('admin123');
    } else {
      setEmail('tech@maintainiq.com');
      setPassword('tech123');
    }
    setLoginError('');
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error(e);
    }
    setCurrentUser(null);
    setView('login');
    // Clear browser address bar path if any public url was left
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  };

  // Loading Overlay
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-slate-300 font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-teal-500"></div>
          <span className="text-sm font-semibold tracking-wide uppercase font-mono animate-pulse">Initializing MaintainIQ Secure Core...</span>
        </div>
      </div>
    );
  }

  // PUBLIC PORTAL ROUTE
  if (view === 'public') {
    return (
      <PublicAssetView
        assetCode={publicAssetCode}
        onGoBackToLogin={() => {
          window.history.pushState({}, '', '/');
          setView('login');
        }}
      />
    );
  }

  // WORKSPACE VIEW (AUTHENTICATED STAFF AREA)
  if (view === 'workspace' && currentUser) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
        {/* Navigation Sidebar */}
        <Navigation
          user={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
        />

        {/* Scrollable Work Deck */}
        <main className="flex-1 overflow-y-auto h-screen relative bg-[#f8fafc]">
          
          {/* Top Info Bar */}
          <header className="hidden md:flex h-16 items-center justify-between px-8 border-b border-slate-100 bg-white sticky top-0 z-30 shadow-sm/5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400">Current Facility Zone</span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold font-mono">NORTH-WING-CENTRAL</span>
            </div>
            <div className="flex items-center space-x-3 text-slate-500 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-600 font-mono">ALL SYSTEMS ONLINE</span>
            </div>
          </header>

          {/* Active View Deck */}
          <div className="pb-16">
            {activeTab === 'dashboard' && stats && (
              <Dashboard
                stats={stats}
                loading={statsLoading}
                onNavigateToTab={setActiveTab}
              />
            )}

            {activeTab === 'assets' && (
              <AssetManagement
                currentUser={currentUser}
                onNavigateToPublicAsset={(code) => {
                  setPublicAssetCode(code);
                  setView('public');
                  window.history.pushState({}, '', `/asset/public/${code}`);
                }}
              />
            )}

            {activeTab === 'issues' && (
              <IssuesQueue
                currentUser={currentUser}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  // STAFF LOGIN SCREEN
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 font-sans select-none">
      
      {/* Login Card */}
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden animate-zoom-in">
        
        {/* Accent Flare */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl" />
        
        {/* Header */}
        <div className="text-center relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-slate-950 font-display font-black text-2xl shadow-lg shadow-teal-500/20 mx-auto">
            M
          </div>
          <h2 className="font-display font-bold text-2xl text-white tracking-tight mt-4">
            {authMode === 'login' ? 'MaintainIQ Staff Entrance' : 'Create Technician Account'}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {authMode === 'login'
              ? 'Smart asset logs, automated dispatches & safety audits.'
              : 'Self-service sign-up provisions a Technician account. Admin accounts are created by an existing Admin.'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex rounded-xl bg-slate-950 border border-slate-800 p-1 text-xs font-semibold">
          <button
            id="auth-mode-login"
            type="button"
            onClick={() => switchAuthMode('login')}
            className={`flex-1 py-2 rounded-lg transition-all ${authMode === 'login' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Sign In
          </button>
          <button
            id="auth-mode-register"
            type="button"
            onClick={() => switchAuthMode('register')}
            className={`flex-1 py-2 rounded-lg transition-all ${authMode === 'register' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Register
          </button>
        </div>

        {/* Login / Register Form */}
        <form onSubmit={authMode === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
          {loginError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold leading-normal font-sans">
              {loginError}
            </div>
          )}

          {authMode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Full Name</label>
              <input
                id="register-name"
                type="text"
                required
                placeholder="Jane Technician"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 px-4 text-xs text-white outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-sans"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Facility Email</label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="name@maintainiq.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 px-4 text-xs text-white outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-sans"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Password</label>
            </div>
            <input
              id="login-password"
              type="password"
              required
              minLength={authMode === 'register' ? 6 : undefined}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 px-4 text-xs text-white outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-sans"
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loginLoading}
            className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-teal-500 py-3.5 font-bold text-slate-950 hover:bg-teal-400 shadow-lg shadow-teal-500/10 transition-all text-sm mt-2"
          >
            {authMode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
            <span>
              {loginLoading
                ? (authMode === 'login' ? 'Authenticating credentials...' : 'Creating account...')
                : (authMode === 'login' ? 'Enter Workspace' : 'Create Account & Enter Workspace')}
            </span>
          </button>
        </form>

        {/* Demo Credentials Box */}
        {authMode === 'login' && (
        <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 space-y-3 relative">
          <div className="flex items-center space-x-1.5 font-bold text-teal-400 text-[10px] uppercase tracking-wider font-mono">
            <Sparkles size={12} />
            <span>Hackathon Demonstration Credentials</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              id="quick-login-admin"
              type="button"
              onClick={() => handleQuickLogin('Admin')}
              className="p-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 text-left space-y-1 transition-all"
            >
              <div className="flex items-center space-x-1 text-indigo-400 font-semibold uppercase tracking-wider text-[9px]">
                <ShieldCheck size={11} />
                <span>Administrator</span>
              </div>
              <span className="block text-[10px] font-mono text-slate-400 truncate">admin@maintainiq.com</span>
              <span className="block text-[9px] font-mono text-slate-500">pass: admin123</span>
            </button>

            <button
              id="quick-login-tech"
              type="button"
              onClick={() => handleQuickLogin('Technician')}
              className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-left space-y-1 transition-all"
            >
              <div className="flex items-center space-x-1 text-amber-400 font-semibold uppercase tracking-wider text-[9px]">
                <Users size={11} />
                <span>Technician</span>
              </div>
              <span className="block text-[10px] font-mono text-slate-400 truncate">tech@maintainiq.com</span>
              <span className="block text-[9px] font-mono text-slate-500">pass: tech123</span>
            </button>
          </div>
        </div>
        )}

      </div>

      {/* Footer Details */}
      <footer className="text-[10px] text-slate-600 font-mono mt-6 text-center max-w-sm">
        <p>MaintainIQ Core Engine v1.4.0 • Compliant with Vercel and Render Production Standards.</p>
      </footer>

    </div>
  );
}
