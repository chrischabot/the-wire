/**
 * Client-side JavaScript for The Wire application
 * Contains API client, auth, WebSocket, theme management, and utilities
 */

export function getClientJS(): string {
  return `const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const response = await fetch(API_BASE + endpoint, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

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

const users = {
  async getProfile(handle) {
    return await apiRequest('/users/' + handle);
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

const posts = {
  async create(content, mediaUrls = [], replyToId = null, quoteOfId = null) {
    return await apiRequest('/posts', {
      method: 'POST',
      body: JSON.stringify({ content, mediaUrls, replyToId, quoteOfId }),
    });
  },

  async get(postId) {
    return await apiRequest('/posts/' + postId);
  },

  async delete(postId) {
    return await apiRequest('/posts/' + postId, {
      method: 'DELETE',
    });
  },

  async like(postId) {
    return await apiRequest('/posts/' + postId + '/like', {
      method: 'POST',
    });
  },

  async unlike(postId) {
    return await apiRequest('/posts/' + postId + '/like', {
      method: 'DELETE',
    });
  },

  async repost(postId) {
    return await apiRequest('/posts/' + postId + '/repost', {
      method: 'POST',
    });
  },
};

const media = {
  async uploadMedia(file) {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(API_BASE + '/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },

  async uploadAvatar(file) {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(API_BASE + '/media/users/me/avatar', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },

  async uploadBanner(file) {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(API_BASE + '/media/users/me/banner', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },
};

const social = {
  async follow(handle) {
    return await apiRequest('/users/' + handle + '/follow', {
      method: 'POST',
    });
  },

  async unfollow(handle) {
    return await apiRequest('/users/' + handle + '/follow', {
      method: 'DELETE',
    });
  },

  async block(handle) {
    return await apiRequest('/users/' + handle + '/block', {
      method: 'POST',
    });
  },

  async unblock(handle) {
    return await apiRequest('/users/' + handle + '/block', {
      method: 'DELETE',
    });
  },

  async getFollowers(handle) {
    return await apiRequest('/users/' + handle + '/followers');
  },

  async getFollowing(handle) {
    return await apiRequest('/users/' + handle + '/following');
  },

  async getBlocked() {
    return await apiRequest('/users/me/blocked');
  },
};

const notifications = {
  async getAll(cursor, limit = 20) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    return await apiRequest('/notifications?' + params.toString());
  },

  async getUnreadCount() {
    return await apiRequest('/notifications/unread-count');
  },

  async markAsRead(notificationId) {
    return await apiRequest('/notifications/' + notificationId + '/read', {
      method: 'PUT',
    });
  },

  async markAllAsRead() {
    return await apiRequest('/notifications/read-all', {
      method: 'PUT',
    });
  },
};

const theme = {
  current: 'maia',

  init() {
    const saved = localStorage.getItem('the_wire_theme');
    if (saved) {
      this.apply(saved);
    } else {
      this.apply('maia');
    }
    // Enable transitions only after initial theme is applied
    requestAnimationFrame(() => {
      document.body.classList.add('theme-loaded');
    });
  },
  
  apply(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    this.current = themeName;
    localStorage.setItem('the_wire_theme', themeName);
  },
  
  get() {
    return this.current;
  },
  
  getAll() {
    return [
      { name: 'twitter', display: 'Twitter', desc: 'Pure black, blue accent' },
      { name: 'vega', display: 'Vega', desc: 'Classic shadcn slate' },
      { name: 'nova', display: 'Nova', desc: 'Compact & efficient' },
      { name: 'maia', display: 'Maia', desc: 'Soft & rounded' },
      { name: 'lyra', display: 'Lyra', desc: 'Boxy & monospace' },
      { name: 'mira', display: 'Mira', desc: 'Ultra dense' }
    ];
  }
};

if (typeof window !== 'undefined') {
  theme.init();
}

const ws = {
  socket: null,
  listeners: {},
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  heartbeatInterval: null,
  
  connect() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('Cannot connect WebSocket: No auth token');
      return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/api/ws?token=' + token;
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      
      this.heartbeatInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (this.listeners[data.type]) {
          this.listeners[data.type].forEach(callback => callback(data));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };
    
    this.socket.onclose = () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  },
  
  disconnect() {
    if (this.socket) {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      this.socket.close();
      this.socket = null;
    }
  },
  
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  },
  
  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
    }
  },
};

// Notification badge management
const notificationBadge = {
  count: 0,

  update(count) {
    this.count = count;
    const badges = document.querySelectorAll('#notification-badge, #bottom-notification-badge');

    badges.forEach(badge => {
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count.toString();
          badge.classList.add('show');
        } else {
          badge.classList.remove('show');
        }
      }
    });
  },

  increment() {
    this.update(this.count + 1);
  },

  clear() {
    this.update(0);
  },

  async fetch() {
    if (!auth.isAuthenticated()) return;

    try {
      const response = await notifications.getUnreadCount();
      if (response.success && typeof response.data.count === 'number') {
        this.update(response.data.count);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  }
};

// Initialize notifications on page load
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    if (auth.isAuthenticated()) {
      // Fetch initial unread count
      notificationBadge.fetch();

      // Connect WebSocket and listen for notifications
      ws.connect();
      ws.on('notification', function(data) {
        notificationBadge.increment();
      });

      // If on notifications page, mark all as read after a short delay
      if (window.location.pathname === '/notifications') {
        setTimeout(function() {
          notifications.markAllAsRead().then(function() {
            notificationBadge.clear();
          }).catch(function(err) {
            console.error('Failed to mark notifications as read:', err);
          });
        }, 1000);
      }
    }
  });
}

function linkifyMentions(text) {
  if (!text) return '';
  // Unified mention regex: 3-15 chars, alphanumeric + underscore, case insensitive
  var result = text.replace(/@([a-zA-Z0-9_]{3,15})/gi, '<a href="/u/$1" class="mention" onclick="event.stopPropagation()">@$1</a>');
  result = result.replace(/#([a-zA-Z0-9_]+)/g, '<a href="/search?q=%23$1" class="mention" onclick="event.stopPropagation()">#$1</a>');
  result = result.replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" class="link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>');
  return result;
}`;
}
