/**
 * API Client for The Wire
 */

const API_BASE = '/api';

/**
 * Make an authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

/**
 * Auth API calls
 */
const auth = {
  async signup(email, password, handle) {
    const response = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, handle }),
    });
    
    if (response.success && response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user_id', response.data.user.id);
      localStorage.setItem('user_handle', response.data.user.handle);
    }
    
    return response;
  },

  async login(email, password) {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.success && response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user_id', response.data.user.id);
      localStorage.setItem('user_handle', response.data.user.handle);
    }
    
    return response;
  },

  async logout() {
    const response = await apiRequest('/auth/logout', { method: 'POST' });
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_handle');
    return response;
  },

  async me() {
    return await apiRequest('/auth/me');
  },

  isAuthenticated() {
    return !!localStorage.getItem('auth_token');
  },

  getUserHandle() {
    return localStorage.getItem('user_handle');
  },
};

/**
 * Users API calls
 */
const users = {
  async getProfile(handle) {
    return await apiRequest(`/users/${handle}`);
  },

  async updateProfile(updates) {
    return await apiRequest('/users/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async getSettings() {
    return await apiRequest('/users/me/settings');
  },

  async updateSettings(updates) {
    return await apiRequest('/users/me/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
};