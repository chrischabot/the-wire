import { getBottomNavHtml } from "../shared/bottom-nav";

export function getSettingsPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Settings - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <a href="/home" class="logo">
        <span class="logo-text">The Wire</span>
      </a>
      
      <a href="/home" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Explore</span>
      </a>
      <a href="/notifications" class="nav-item" id="notifications-nav">
        <span class="nav-icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span class="notification-badge" id="notification-badge"></span>
        </span>
        <span>Notifications</span>
      </a>
      <a href="#" class="nav-item" id="profile-nav">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Profile</span>
      </a>
      <a href="/settings" class="nav-item active">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </a>
      
      <button class="post-button">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <h2>Settings</h2>
      </div>

      <div style="padding: 20px;">
        <!-- Theme Selection -->
        <div class="settings-section">
          <h3>Appearance</h3>
          <div class="theme-switcher">
            <label class="theme-switcher-label">Choose your theme</label>
            <div class="theme-options">
              <div class="theme-option" data-theme="twitter">
                <div class="theme-option-name">Twitter</div>
                <div class="theme-option-desc">Pure black, blue accent</div>
              </div>
              <div class="theme-option" data-theme="vega">
                <div class="theme-option-name">Vega</div>
                <div class="theme-option-desc">Classic shadcn slate</div>
              </div>
              <div class="theme-option" data-theme="nova">
                <div class="theme-option-name">Nova</div>
                <div class="theme-option-desc">Compact & efficient</div>
              </div>
              <div class="theme-option" data-theme="maia">
                <div class="theme-option-name">Maia</div>
                <div class="theme-option-desc">Soft & rounded</div>
              </div>
              <div class="theme-option" data-theme="lyra">
                <div class="theme-option-name">Lyra</div>
                <div class="theme-option-desc">Boxy & monospace</div>
              </div>
              <div class="theme-option" data-theme="mira">
                <div class="theme-option-name">Mira</div>
                <div class="theme-option-desc">Ultra dense</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Profile Settings -->
        <div class="settings-section">
          <h3>Profile</h3>

          <!-- Banner & Avatar with camera overlays -->
          <div class="profile-media-editor">
            <div class="banner-editor" id="banner-editor">
              <div id="current-banner" class="banner-preview media-zoomable" data-zoomable="true" role="button" tabindex="0" aria-label="View banner"></div>
              <button type="button" class="media-edit-btn" id="banner-edit-btn" title="Change banner">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              </button>
              <input type="file" id="banner-file" accept="image/*" hidden>
            </div>
            <div class="avatar-editor-wrapper">
              <div class="avatar-editor" id="avatar-editor">
                <div id="current-avatar" class="avatar-preview media-zoomable" data-zoomable="true" role="button" tabindex="0" aria-label="View avatar"></div>
                <button type="button" class="media-edit-btn" id="avatar-edit-btn" title="Change avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                </button>
                <input type="file" id="avatar-file" accept="image/*" hidden>
              </div>
            </div>
            <div id="media-upload-status" class="media-upload-status"></div>
          </div>

          <form id="profile-form">
            <div class="form-group">
              <label for="displayName">Display Name</label>
              <input type="text" id="displayName" maxlength="50">
            </div>

            <div class="form-group">
              <label for="bio">Bio</label>
              <textarea id="bio" maxlength="160" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label for="location">Location</label>
              <input type="text" id="location" maxlength="50">
            </div>

            <div class="form-group">
              <label for="website">Website</label>
              <input type="url" id="website">
            </div>

            <button type="submit" class="btn-primary" id="save-profile-btn">Save Profile</button>
          </form>
          <div id="profile-success" class="success"></div>
          <div id="profile-error" class="error"></div>
        </div>

        <!-- Content Settings -->
        <div class="settings-section">
          <h3>Content</h3>
          <a href="/settings/muted" class="settings-link">
            <span>Muted words</span>
            <span class="settings-link-hint">Manage filters</span>
          </a>
          <div class="settings-link-desc">Hide posts containing specific words or phrases.</div>
        </div>

        <!-- Account Actions -->
        <div class="settings-section">
          <h3>Account</h3>
          <button class="btn-secondary" id="logout-btn">Log Out</button>
        </div>
      </div>
    </div>

    ${getBottomNavHtml()}
    <!-- Right Sidebar -->
    <div class="sidebar-right">
      <div class="search-box">
        <input type="text" class="search-input" id="sidebar-search" placeholder="Search" onkeypress="if(event.key==='Enter' && this.value.trim().length >= 2) window.location.href='/search?q='+encodeURIComponent(this.value.trim())">
      </div>
    </div>
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }

    async function setProfileLink() {
      try {
        const response = await auth.me();
        if (response.success) {
          document.querySelectorAll('#profile-nav, #bottom-profile-nav').forEach(el => el.href = '/u/' + response.data.handle);
        }
      } catch (error) {
        console.error('Error getting profile:', error);
      }
    }
    setProfileLink();

    const currentTheme = theme.get();
    document.querySelectorAll('.theme-option').forEach(option => {
      if (option.dataset.theme === currentTheme) {
        option.classList.add('active');
      }
      
      option.addEventListener('click', () => {
        document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        theme.apply(option.dataset.theme);
      });
    });

    let currentUser = null;

    async function loadProfile() {
      try {
        const response = await auth.me();
        if (response.success) {
          const profileResp = await users.getProfile(response.data.handle);
          if (profileResp.success) {
            currentUser = profileResp.data;
            
            document.getElementById('displayName').value = currentUser.displayName || '';
            document.getElementById('bio').value = currentUser.bio || '';
            document.getElementById('location').value = currentUser.location || '';
            document.getElementById('website').value = currentUser.website || '';
            
            const avatarEl = document.getElementById('current-avatar');
            const bannerEl = document.getElementById('current-banner');

            if (avatarEl) {
              if (currentUser.avatarUrl) {
                avatarEl.style.backgroundImage =
                  'url(' + currentUser.avatarUrl + '?width=128&quality=80)';
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.setAttribute('data-fullsrc', currentUser.avatarUrl);
              } else {
                avatarEl.style.backgroundImage = '';
                avatarEl.removeAttribute('data-fullsrc');
              }
            }

            if (bannerEl) {
              if (currentUser.bannerUrl) {
                bannerEl.style.backgroundImage =
                  'url(' + currentUser.bannerUrl + '?width=800&quality=85)';
                bannerEl.style.backgroundSize = 'cover';
                bannerEl.setAttribute('data-fullsrc', currentUser.bannerUrl);
              } else {
                bannerEl.style.backgroundImage = '';
                bannerEl.removeAttribute('data-fullsrc');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    }

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const successMsg = document.getElementById('profile-success');
      const errorMsg = document.getElementById('profile-error');
      
      try {
        await users.updateProfile({
          displayName: document.getElementById('displayName').value,
          bio: document.getElementById('bio').value,
          location: document.getElementById('location').value,
          website: document.getElementById('website').value,
        });
        successMsg.textContent = 'Profile updated successfully!';
        setTimeout(() => { successMsg.textContent = ''; }, 3000);
      } catch (error) {
        errorMsg.textContent = error.message;
      }
    });

    // Avatar upload - click icon to open file dialog
    document.getElementById('avatar-edit-btn').addEventListener('click', () => {
      document.getElementById('avatar-file').click();
    });

    document.getElementById('avatar-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const status = document.getElementById('media-upload-status');
      const avatarEditor = document.getElementById('avatar-editor');

      try {
        avatarEditor.classList.add('uploading');
        status.textContent = 'Uploading avatar...';
        status.className = 'media-upload-status uploading';

        await media.uploadAvatar(file);

        status.textContent = 'Avatar updated!';
        status.className = 'media-upload-status success';
        await loadProfile();

        setTimeout(() => {
          status.textContent = '';
          status.className = 'media-upload-status';
        }, 2000);
      } catch (error) {
        status.textContent = error.message;
        status.className = 'media-upload-status error';
      } finally {
        avatarEditor.classList.remove('uploading');
        e.target.value = ''; // Reset file input
      }
    });

    // Banner upload - click icon to open file dialog
    document.getElementById('banner-edit-btn').addEventListener('click', () => {
      document.getElementById('banner-file').click();
    });

    document.getElementById('banner-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const status = document.getElementById('media-upload-status');
      const bannerEditor = document.getElementById('banner-editor');

      try {
        bannerEditor.classList.add('uploading');
        status.textContent = 'Uploading banner...';
        status.className = 'media-upload-status uploading';

        await media.uploadBanner(file);

        status.textContent = 'Banner updated!';
        status.className = 'media-upload-status success';
        await loadProfile();

        setTimeout(() => {
          status.textContent = '';
          status.className = 'media-upload-status';
        }, 2000);
      } catch (error) {
        status.textContent = error.message;
        status.className = 'media-upload-status error';
      } finally {
        bannerEditor.classList.remove('uploading');
        e.target.value = ''; // Reset file input
      }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
      try {
        await auth.logout();
        window.location.href = '/';
      } catch (error) {
        window.location.href = '/';
      }
    });

    loadProfile();
  </script>
  <script>
    const bottomNav = document.getElementById('bottom-nav');
    let lastScrollY = window.scrollY;
    if (bottomNav) {
      window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
          bottomNav.classList.add('hidden');
        } else if (currentScrollY < lastScrollY) {
          bottomNav.classList.remove('hidden');
        }
        lastScrollY = currentScrollY;
      });
    }
  </script>
</body>
</html>
  `;
}


export function getMutedSettingsPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Muted Words - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <a href="/home" class="logo">
        <span class="logo-text">The Wire</span>
      </a>
      
      <a href="/home" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Explore</span>
      </a>
      <a href="/notifications" class="nav-item" id="notifications-nav">
        <span class="nav-icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span class="notification-badge" id="notification-badge"></span>
        </span>
        <span>Notifications</span>
      </a>
      <a href="#" class="nav-item" id="profile-nav">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Profile</span>
      </a>
      <a href="/settings" class="nav-item active">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </a>
      
      <button class="post-button">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <h2>Muted words</h2>
      </div>

      <div style="padding: 20px;">
        <div class="settings-section">
          <h3>Manage muted words</h3>
          <div class="settings-link-desc">
            Hide posts containing specific words or phrases. Choose how long the mute lasts and whether it applies to everyone or only people you don’t follow.
          </div>

          <form id="mute-form" class="muted-words-form">
            <div class="form-group">
              <label for="mute-word">Word or phrase</label>
              <input type="text" id="mute-word" maxlength="50" placeholder="e.g. crypto, spoilers">
            </div>
            <div class="muted-words-row">
              <div class="form-group">
                <label for="mute-duration">Duration</label>
                <select id="mute-duration">
                  <option value="forever">Forever</option>
                  <option value="86400000">1 day</option>
                  <option value="604800000">7 days</option>
                  <option value="2592000000">30 days</option>
                  <option value="7776000000">90 days</option>
                </select>
              </div>
              <div class="form-group">
                <label for="mute-scope">Scope</label>
                <select id="mute-scope">
                  <option value="all">Everyone</option>
                  <option value="not_following">Everyone except people you follow</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn-primary">Add muted word</button>
          </form>

          <div id="mute-success" class="success"></div>
          <div id="mute-error" class="error"></div>
          <div id="mute-list" class="muted-words-list"></div>
        </div>
      </div>
    </div>

    ${getBottomNavHtml()}
    <!-- Right Sidebar -->
    <div class="sidebar-right">
      <div class="search-box">
        <input type="text" class="search-input" id="sidebar-search" placeholder="Search" onkeypress="if(event.key==='Enter' && this.value.trim().length >= 2) window.location.href='/search?q='+encodeURIComponent(this.value.trim())">
      </div>
    </div>
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }

    async function setProfileLink() {
      try {
        const response = await auth.me();
        if (response.success) {
          document.querySelectorAll('#profile-nav, #bottom-profile-nav').forEach(el => el.href = '/u/' + response.data.handle);
        }
      } catch (error) {
        console.error('Error getting profile:', error);
      }
    }
    setProfileLink();

    const MAX_MUTED_WORDS = 100;
    let mutedWords = [];

    function normalizeMutedWords(input) {
      if (!Array.isArray(input)) {
        return { list: [], changed: input !== undefined };
      }

      const now = Date.now();
      const list = [];
      const seen = new Set();
      let changed = false;

      input.forEach((entry) => {
        let word = '';
        let scope = 'all';
        let expiresAt = null;

        if (typeof entry === 'string') {
          word = entry;
          changed = true;
        } else if (entry && typeof entry === 'object') {
          word = typeof entry.word === 'string' ? entry.word : '';
          scope = entry.scope === 'not_following' ? 'not_following' : 'all';
          if (entry.scope && entry.scope !== scope) {
            changed = true;
          }
          if (typeof entry.expiresAt === 'number') {
            expiresAt = entry.expiresAt;
          } else if (entry.expiresAt != null) {
            changed = true;
          }
        } else {
          changed = true;
          return;
        }

        const normalized = word.trim().toLowerCase();
        if (!normalized) {
          changed = true;
          return;
        }
        if (normalized !== word) {
          changed = true;
        }
        if (expiresAt && expiresAt <= now) {
          changed = true;
          return;
        }

        const key = normalized + ':' + scope;
        if (seen.has(key)) {
          changed = true;
          return;
        }
        seen.add(key);

        const record = { word: normalized, scope: scope };
        if (expiresAt) {
          record.expiresAt = expiresAt;
        }
        list.push(record);
      });

      if (list.length > MAX_MUTED_WORDS) {
        list.splice(MAX_MUTED_WORDS);
        changed = true;
      }

      return { list, changed };
    }

    function formatScope(scope) {
      return scope === 'not_following' ? 'Everyone except people you follow' : 'Everyone';
    }

    function formatExpiry(expiresAt) {
      if (!expiresAt) return 'Forever';
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) return 'Expired';
      const days = Math.ceil(remaining / 86400000);
      if (days <= 1) return 'Expires in 1 day';
      if (days < 7) return 'Expires in ' + days + ' days';
      const weeks = Math.ceil(days / 7);
      if (weeks < 5) return 'Expires in ' + weeks + ' weeks';
      const months = Math.ceil(days / 30);
      return 'Expires in ' + months + ' months';
    }

    function renderMutedWords() {
      const list = document.getElementById('mute-list');
      if (!mutedWords.length) {
        list.innerHTML = '<div class="empty-state">No muted words yet</div>';
        return;
      }

      list.innerHTML = mutedWords.map((entry) => {
        const scopeLabel = formatScope(entry.scope);
        const expiryLabel = formatExpiry(entry.expiresAt);
        return '<div class="muted-word-item">' +
          '<div>' +
            '<div class="muted-word-text">' + entry.word + '</div>' +
            '<div class="muted-word-meta">' + scopeLabel + ' • ' + expiryLabel + '</div>' +
          '</div>' +
          '<button class="btn-secondary" data-remove="true" data-word="' + entry.word + '" data-scope="' + (entry.scope || 'all') + '">Remove</button>' +
        '</div>';
      }).join('');
    }

    async function saveMutedWords() {
      const successMsg = document.getElementById('mute-success');
      const errorMsg = document.getElementById('mute-error');
      successMsg.textContent = '';
      errorMsg.textContent = '';

      try {
        await users.updateSettings({ mutedWords: mutedWords });
        successMsg.textContent = 'Muted words updated';
        setTimeout(() => { successMsg.textContent = ''; }, 2000);
      } catch (error) {
        errorMsg.textContent = error.message || 'Failed to update muted words';
      }
    }

    async function loadMutedWords() {
      try {
        const response = await users.getSettings();
        if (!response.success) return;
        const normalized = normalizeMutedWords(response.data.mutedWords || []);
        mutedWords = normalized.list;
        renderMutedWords();
        if (normalized.changed) {
          await saveMutedWords();
        }
      } catch (error) {
        document.getElementById('mute-error').textContent = 'Failed to load muted words';
      }
    }

    document.getElementById('mute-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorMsg = document.getElementById('mute-error');
      errorMsg.textContent = '';

      const wordInput = document.getElementById('mute-word');
      const durationSelect = document.getElementById('mute-duration');
      const scopeSelect = document.getElementById('mute-scope');
      const word = wordInput.value.trim().toLowerCase();

      if (!word) {
        errorMsg.textContent = 'Enter a word or phrase to mute.';
        return;
      }

      const scope = scopeSelect.value === 'not_following' ? 'not_following' : 'all';
      const key = word + ':' + scope;
      const exists = mutedWords.some((entry) => entry.word + ':' + (entry.scope || 'all') === key);
      if (exists) {
        errorMsg.textContent = 'That word is already muted.';
        return;
      }

      let expiresAt = null;
      const durationValue = durationSelect.value;
      if (durationValue !== 'forever') {
        const durationMs = parseInt(durationValue, 10);
        if (!Number.isNaN(durationMs)) {
          expiresAt = Date.now() + durationMs;
        }
      }

      if (mutedWords.length >= MAX_MUTED_WORDS) {
        errorMsg.textContent = 'Mute list is full. Remove a word to add another.';
        return;
      }

      const entry = { word: word, scope: scope };
      if (expiresAt) {
        entry.expiresAt = expiresAt;
      }

      mutedWords.unshift(entry);
      wordInput.value = '';
      renderMutedWords();
      await saveMutedWords();
    });

    document.getElementById('mute-list').addEventListener('click', async (event) => {
      const target = event.target;
      if (!target || !target.dataset || target.dataset.remove !== 'true') return;
      const word = target.dataset.word;
      const scope = target.dataset.scope || 'all';
      mutedWords = mutedWords.filter((entry) => !(entry.word === word && (entry.scope || 'all') === scope));
      renderMutedWords();
      await saveMutedWords();
    });

    loadMutedWords();
  </script>
  <script>
    const bottomNav = document.getElementById('bottom-nav');
    let lastScrollY = window.scrollY;
    if (bottomNav) {
      window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
          bottomNav.classList.add('hidden');
        } else if (currentScrollY < lastScrollY) {
          bottomNav.classList.remove('hidden');
        }
        lastScrollY = currentScrollY;
      });
    }
  </script>
</body>
</html>
  `;
}
