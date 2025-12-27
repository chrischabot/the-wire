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
 * Theme management
 */
const theme = {
  current: localStorage.getItem('theme') || 'twitter',

  themes: [
    { name: 'twitter', display: 'Twitter', desc: 'Classic blue' },
    { name: 'vega', display: 'Vega', desc: 'Purple vibes' },
    { name: 'nova', display: 'Nova', desc: 'Orange energy' },
    { name: 'maia', display: 'Maia', desc: 'Soft & rounded' },
    { name: 'lyra', display: 'Lyra', desc: 'Green nature' },
    { name: 'mira', display: 'Mira', desc: 'Pink dream' },
  ],

  init() {
    const saved = localStorage.getItem('theme');
    if (saved && this.themes.find(t => t.name === saved)) {
      this.apply(saved);
    } else {
      this.apply('twitter');
    }
  },

  apply(themeName) {
    const theme = this.themes.find(t => t.name === themeName);
    if (!theme) return;

    document.documentElement.setAttribute('data-theme', themeName);
    this.current = themeName;
    localStorage.setItem('theme', themeName);

    // Dispatch event for components that need to react
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: themeName } }));
  },

  get() {
    return this.current;
  },

  getAll() {
    return this.themes;
  },

  toggle() {
    const currentIndex = this.themes.findIndex(t => t.name === this.current);
    const nextIndex = (currentIndex + 1) % this.themes.length;
    this.apply(this.themes[nextIndex].name);
  }
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
 * Social API calls (follow/unfollow/block)
 */
const social = {
  async follow(handle) {
    return await apiRequest(`/users/${handle}/follow`, {
      method: 'POST',
    });
  },

  async unfollow(handle) {
    return await apiRequest(`/users/${handle}/follow`, {
      method: 'DELETE',
    });
  },

  async block(handle) {
    return await apiRequest(`/users/${handle}/block`, {
      method: 'POST',
    });
  },

  async unblock(handle) {
    return await apiRequest(`/users/${handle}/block`, {
      method: 'DELETE',
    });
  },

  async getFollowers(handle) {
    return await apiRequest(`/users/${handle}/followers`);
  },

  async getFollowing(handle) {
    return await apiRequest(`/users/${handle}/following`);
  },

  async isFollowing(handle) {
    const profile = await apiRequest(`/users/${handle}`);
    return profile.data?.isFollowing || false;
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
  // Unified mention regex: 3-15 chars, alphanumeric + underscore, case insensitive
  let result = text.replace(/@([a-zA-Z0-9_]{3,15})/gi, '<a href="/u/$1" class="mention" onclick="event.stopPropagation()">@$1</a>');
  // Match #hashtag (alphanumeric and underscores)
  result = result.replace(/#([a-zA-Z0-9_]+)/g, '<a href="/search?q=%23$1" class="mention" onclick="event.stopPropagation()">#$1</a>');
  // Match URLs
  result = result.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" class="link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>');
  return result;
}

function ensureImageModal() {
  let modal = document.getElementById('image-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'image-modal';
  modal.className = 'image-modal';
  modal.setAttribute('aria-hidden', 'true');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'image-modal-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u00d7';

  const img = document.createElement('img');
  img.id = 'modal-image';
  img.alt = 'Full size image';

  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    closeImageModal();
  });
  img.addEventListener('click', (event) => event.stopPropagation());
  modal.addEventListener('click', closeImageModal);

  modal.appendChild(closeBtn);
  modal.appendChild(img);
  document.body.appendChild(modal);

  return modal;
}

function openImageModal(imageUrl, altText) {
  if (!imageUrl) return;
  const modal = ensureImageModal();
  const modalImg = modal.querySelector('#modal-image');
  modalImg.src = imageUrl;
  modalImg.alt = altText || 'Full size image';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function initImageModal() {
  ensureImageModal();

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const zoomTarget = target.closest(
      '[data-zoomable="true"], img.avatar, img.user-card-avatar, img.post-media-item, img.quoted-post-media-item, img.profile-banner, img.profile-banner-clickable'
    );
    if (!zoomTarget) return;
    const fullSrc = zoomTarget.getAttribute('data-fullsrc') || (zoomTarget.tagName === 'IMG' ? zoomTarget.src : null);
    if (!fullSrc) return;
    event.preventDefault();
    event.stopPropagation();
    openImageModal(fullSrc, zoomTarget.getAttribute('alt'));
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeImageModal();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const zoomTarget = target.closest(
      '[data-zoomable="true"], img.avatar, img.user-card-avatar, img.post-media-item, img.quoted-post-media-item, img.profile-banner, img.profile-banner-clickable'
    );
    if (!zoomTarget) return;
    const fullSrc = zoomTarget.getAttribute('data-fullsrc') || (zoomTarget.tagName === 'IMG' ? zoomTarget.src : null);
    if (!fullSrc) return;
    event.preventDefault();
    openImageModal(fullSrc, zoomTarget.getAttribute('alt'));
  });
}

// Initialize theme and shared UI on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      theme.init();
      initImageModal();
    });
  } else {
    theme.init();
    initImageModal();
  }
}
