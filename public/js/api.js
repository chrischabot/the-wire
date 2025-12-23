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

/**
 * Theme management (Maia only)
 */
const theme = {
  current: 'maia',
  init() {},
  apply() {},
  get() { return 'maia'; },
  getAll() { return [{ name: 'maia', display: 'Maia', desc: 'Soft & rounded' }]; }
};

/**
 * Posts API calls
 */
const posts = {
  async create(content, options = {}) {
    return await apiRequest('/posts', {
      method: 'POST',
      body: JSON.stringify({
        content,
        ...options,
      }),
    });
  },

  async get(postId) {
    return await apiRequest(`/posts/${postId}`);
  },

  async delete(postId) {
    return await apiRequest(`/posts/${postId}`, {
      method: 'DELETE',
    });
  },

  async like(postId) {
    return await apiRequest(`/posts/${postId}/like`, {
      method: 'POST',
    });
  },

  async unlike(postId) {
    return await apiRequest(`/posts/${postId}/like`, {
      method: 'DELETE',
    });
  },

  async repost(postId) {
    return await apiRequest(`/posts/${postId}/repost`, {
      method: 'POST',
    });
  },
};

/**
 * Feed API calls
 */
const feed = {
  async getHome(cursor = null, limit = 20) {
    let url = `/feed/home?limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    return await apiRequest(url);
  },

  async getUser(handle, cursor = null, limit = 20) {
    let url = `/feed/user/${handle}?limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    return await apiRequest(url);
  },
};

/**
 * Notifications API calls
 */
const notifications = {
  async getAll(cursor = null, limit = 20) {
    let url = `/notifications?limit=${limit}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    return await apiRequest(url);
  },

  async getUnreadCount() {
    return await apiRequest('/notifications/unread-count');
  },

  async markAsRead(notificationId) {
    return await apiRequest(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  async markAllAsRead() {
    return await apiRequest('/notifications/read-all', {
      method: 'PUT',
    });
  },
};

/**
 * Text utilities
 */
function linkifyMentions(text) {
  if (!text) return '';
  // Match @handle (alphanumeric and underscores, 1-15 chars like Twitter)
  return text.replace(/@([a-zA-Z0-9_]{1,15})/g, '<a href="/u/$1" class="mention" onclick="event.stopPropagation()">@$1</a>');
}

// Initialize theme on page load
if (typeof window !== 'undefined') {
  theme.init();
}