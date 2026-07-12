/**
 * MaintainIQ Frontend API Client
 * Supports VITE_API_URL for split-domain deployments (S3 frontend + EC2 backend)
 * Falls back to relative /api for unified same-origin deployments
 */

// Support split-domain deploy: set VITE_API_URL=https://api.yourdomain.com/api at build time
const API_BASE = import.meta.env.VITE_API_URL || '/api';

let unauthorizedHandler = null;

export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  
  // Content type
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  
  if (!response.ok) {
    if (response.status === 401) {
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Authentication
  login: async (email, password) => {
    const res = await fetchJson(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return res.user;
  },
  
  logout: async () => {
    await fetchJson(`${API_BASE}/auth/logout`, { method: 'POST' });
  },
  
  getMe: async () => {
    const res = await fetchJson(`${API_BASE}/auth/me`);
    return res.user;
  },

  getTechnicians: async () => {
    const res = await fetchJson(`${API_BASE}/technicians`);
    return res.technicians;
  },

  // Assets
  getAssets: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchJson(`${API_BASE}/assets${query}`);
    return res.assets;
  },

  getAssetById: async (id) => {
    const res = await fetchJson(`${API_BASE}/assets/${id}`);
    return res.asset;
  },

  getAssetHistory: async (id) => {
    const res = await fetchJson(`${API_BASE}/assets/${id}/history`);
    return res.history;
  },

  getAssetPublic: async (code) => {
    const res = await fetchJson(`${API_BASE}/assets/public/${code}`);
    return res;
  },

  createAsset: async (assetData) => {
    const res = await fetchJson(`${API_BASE}/assets`, {
      method: 'POST',
      body: JSON.stringify(assetData),
    });
    return res.asset;
  },

  updateAsset: async (id, assetData) => {
    const res = await fetchJson(`${API_BASE}/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assetData),
    });
    return res.asset;
  },

  deleteAsset: async (id) => {
    await fetchJson(`${API_BASE}/assets/${id}`, { method: 'DELETE' });
  },

  // Issues
  getIssues: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchJson(`${API_BASE}/issues${query}`);
    return res.issues;
  },

  triageIssueAI: async (description) => {
    const res = await fetchJson(`${API_BASE}/issues/triage`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
    return res.triage;
  },

  createIssue: async (issueData) => {
    const res = await fetchJson(`${API_BASE}/issues`, {
      method: 'POST',
      body: JSON.stringify(issueData),
    });
    return res.issue;
  },

  updateIssue: async (id, updates) => {
    const res = await fetchJson(`${API_BASE}/issues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.issue;
  },

  resolveIssue: async (id, data) => {
    const res = await fetchJson(`${API_BASE}/issues/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res;
  },

  // Dashboard
  getDashboardStats: async () => {
    const res = await fetchJson(`${API_BASE}/dashboard/stats`);
    return res.stats;
  },

  // AI Insights
  getAssetAIInsights: async (id) => {
    const res = await fetchJson(`${API_BASE}/assets/${id}/ai-insights`);
    return res;
  },

  getIssueAIInsights: async (id) => {
    const res = await fetchJson(`${API_BASE}/issues/${id}/ai-insights`);
    return res;
  },

  generateAIDraftSummary: async (inspectionNotes) => {
    const res = await fetchJson(`${API_BASE}/issues/ai-draft-summary`, {
      method: 'POST',
      body: JSON.stringify({ inspectionNotes }),
    });
    return res.summary;
  },

  // File Upload
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchJson(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    return res;
  },
  
  onUnauthorized: registerUnauthorizedHandler
};
