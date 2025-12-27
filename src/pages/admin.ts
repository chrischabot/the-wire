import { getBottomNavHtml } from "../shared/bottom-nav";

export function getAdminPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
  <style>
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--border);
      background: var(--background);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .admin-header h1 {
      font-size: 24px;
      font-weight: 800;
      color: var(--foreground);
    }
    .admin-tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      background: var(--background);
      position: sticky;
      top: 60px;
      z-index: 9;
    }
    .admin-tab {
      flex: 1;
      padding: 16px;
      text-align: center;
      font-weight: 600;
      color: var(--muted-foreground);
      cursor: pointer;
      border: none;
      background: transparent;
      font-size: 15px;
      transition: var(--transition);
      position: relative;
    }
    .admin-tab:hover { background: var(--hover); }
    .admin-tab.active { color: var(--foreground); font-weight: 700; }
    .admin-tab.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 4px;
      background: var(--primary);
      border-radius: 2px;
    }
    .admin-content { padding: 20px; }
    .admin-panel { display: none; }
    .admin-panel.active { display: block; }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--muted);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
    }
    .stat-card h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted-foreground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: 800;
      color: var(--foreground);
    }
    .stat-card .subtitle {
      font-size: 13px;
      color: var(--muted-foreground);
      margin-top: 4px;
    }
    .stat-card.highlight { border-color: var(--primary); }
    .stat-card.warning { border-color: var(--destructive); }

    /* Search Bar */
    .admin-search {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    .admin-search input {
      flex: 1;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 15px;
      background: var(--background);
      color: var(--foreground);
    }
    .admin-search input:focus {
      outline: 2px solid var(--primary);
      border-color: var(--primary);
    }
    .admin-search select {
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 15px;
      background: var(--background);
      color: var(--foreground);
      cursor: pointer;
    }

    /* Data Table */
    .admin-table {
      width: 100%;
      border-collapse: collapse;
    }
    .admin-table th {
      text-align: left;
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted-foreground);
      border-bottom: 1px solid var(--border);
      background: var(--muted);
    }
    .admin-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
      color: var(--foreground);
    }
    .admin-table tr:hover td { background: var(--hover); }

    /* User/Post Row */
    .user-row, .post-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid var(--border);
      transition: var(--transition);
    }
    .user-row:hover, .post-row:hover { background: var(--hover); }
    .user-info, .post-info { flex: 1; min-width: 0; }
    .user-name, .post-author {
      font-weight: 700;
      color: var(--foreground);
      font-size: 15px;
    }
    .user-handle, .post-meta {
      color: var(--muted-foreground);
      font-size: 14px;
    }
    .user-badges { display: flex; gap: 8px; margin-top: 4px; }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-admin { background: var(--primary); color: white; }
    .badge-banned { background: var(--destructive); color: white; }
    .badge-verified { background: var(--success); color: white; }
    .badge-taken-down { background: var(--destructive); color: white; }

    /* Action Buttons */
    .action-buttons { display: flex; gap: 8px; }
    .btn {
      padding: 8px 16px;
      border-radius: var(--radius);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: var(--transition);
    }
    .btn-primary {
      background: var(--primary);
      color: white;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-danger {
      background: var(--destructive);
      color: white;
    }
    .btn-danger:hover { opacity: 0.9; }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--foreground);
    }
    .btn-secondary:hover { background: var(--hover); }
    .btn-success {
      background: var(--success);
      color: white;
    }

    /* Post Content Preview */
    .post-content-preview {
      font-size: 14px;
      color: var(--foreground);
      margin-top: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-backdrop.hidden { display: none; }
    .modal {
      background: var(--background);
      border-radius: var(--radius);
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal h2 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
    }

    /* Loading State */
    .loading {
      text-align: center;
      padding: 40px;
      color: var(--muted-foreground);
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 20px;
    }
  </style>
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
      <a href="/admin" class="nav-item active">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Admin</span>
      </a>
      <a href="/settings" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </a>
    </div>

    <!-- Main Content -->
    <div class="main-content" style="max-width: 900px;">
      <div class="admin-header">
        <h1>Admin Dashboard</h1>
        <span id="admin-user" style="color: var(--muted-foreground);"></span>
      </div>

      <div class="admin-tabs">
        <button class="admin-tab active" data-panel="dashboard">Dashboard</button>
        <button class="admin-tab" data-panel="users">Users</button>
        <button class="admin-tab" data-panel="posts">Posts</button>
      </div>

      <!-- Dashboard Panel -->
      <div id="panel-dashboard" class="admin-panel active">
        <div class="admin-content">
          <div id="stats-loading" class="loading">Loading statistics...</div>
          <div id="stats-container" style="display: none;">
            <div class="stats-grid">
              <div class="stat-card">
                <h3>Total Users</h3>
                <div class="value" id="stat-users">-</div>
                <div class="subtitle"><span id="stat-users-24h">-</span> in last 24h</div>
              </div>
              <div class="stat-card">
                <h3>Total Posts</h3>
                <div class="value" id="stat-posts">-</div>
                <div class="subtitle"><span id="stat-posts-24h">-</span> in last 24h</div>
              </div>
              <div class="stat-card">
                <h3>Total Likes</h3>
                <div class="value" id="stat-likes">-</div>
              </div>
              <div class="stat-card">
                <h3>Total Reposts</h3>
                <div class="value" id="stat-reposts">-</div>
              </div>
              <div class="stat-card warning">
                <h3>Banned Users</h3>
                <div class="value" id="stat-banned">-</div>
              </div>
              <div class="stat-card warning">
                <h3>Taken Down Posts</h3>
                <div class="value" id="stat-takedowns">-</div>
              </div>
            </div>
            <p style="color: var(--muted-foreground); font-size: 13px;">
              Last updated: <span id="stats-updated">-</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Users Panel -->
      <div id="panel-users" class="admin-panel">
        <div class="admin-content">
          <div class="admin-search">
            <input type="text" id="user-search" placeholder="Search users by handle or name...">
            <select id="user-filter">
              <option value="">All Users</option>
              <option value="admin">Admins</option>
              <option value="banned">Banned</option>
            </select>
            <button class="btn btn-primary" onclick="searchUsers()">Search</button>
          </div>
          <div id="users-loading" class="loading">Loading users...</div>
          <div id="users-container"></div>
          <div id="users-pagination" class="pagination"></div>
        </div>
      </div>

      <!-- Posts Panel -->
      <div id="panel-posts" class="admin-panel">
        <div class="admin-content">
          <div class="admin-search">
            <input type="text" id="post-search" placeholder="Search posts by content or author...">
            <select id="post-filter">
              <option value="">All Posts</option>
              <option value="taken-down">Taken Down</option>
            </select>
            <button class="btn btn-primary" onclick="searchPosts()">Search</button>
          </div>
          <div id="posts-loading" class="loading">Loading posts...</div>
          <div id="posts-container"></div>
          <div id="posts-pagination" class="pagination"></div>
        </div>
      </div>
    </div>

    ${getBottomNavHtml()}
    <!-- Right Sidebar -->
    <div class="sidebar-right">
      <div style="padding: 20px;">
        <h3 style="font-size: 20px; font-weight: 800; margin-bottom: 16px;">Quick Actions</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="btn btn-secondary" onclick="refreshStats()">Refresh Stats</button>
          <a href="/home" class="btn btn-secondary" style="text-align: center; text-decoration: none;">Back to Home</a>
        </div>
      </div>
    </div>
  </div>

  <!-- Ban Modal -->
  <div id="ban-modal" class="modal-backdrop hidden">
    <div class="modal">
      <h2>Ban User</h2>
      <p style="color: var(--muted-foreground); margin-bottom: 16px;">
        Banning <strong id="ban-user-handle">@user</strong>
      </p>
      <div class="form-group">
        <label for="ban-reason">Reason for ban</label>
        <textarea id="ban-reason" rows="3" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius); resize: vertical;"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeBanModal()">Cancel</button>
        <button class="btn btn-danger" onclick="confirmBan()">Ban User</button>
      </div>
    </div>
  </div>

  <!-- Takedown Modal -->
  <div id="takedown-modal" class="modal-backdrop hidden">
    <div class="modal">
      <h2>Take Down Post</h2>
      <p style="color: var(--muted-foreground); margin-bottom: 16px;">
        Taking down post <strong id="takedown-post-id"></strong>
      </p>
      <div class="form-group">
        <label for="takedown-reason">Reason for takedown</label>
        <textarea id="takedown-reason" rows="3" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius); resize: vertical;"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeTakedownModal()">Cancel</button>
        <button class="btn btn-danger" onclick="confirmTakedown()">Take Down</button>
      </div>
    </div>
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    let currentUserOffset = 0;
    let currentPostOffset = 0;
    let banTargetHandle = '';
    let takedownTargetId = '';

    // Check admin access
    async function checkAdmin() {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/login';
        return false;
      }

      try {
        const resp = await fetch('/api/users/me', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await resp.json();

        if (!data.success || !data.data.isAdmin) {
          alert('Admin access required');
          window.location.href = '/home';
          return false;
        }

        document.getElementById('admin-user').textContent = 'Logged in as @' + data.data.handle;
        return true;
      } catch (e) {
        console.error('Error checking admin:', e);
        window.location.href = '/login';
        return false;
      }
    }

    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const panel = tab.dataset.panel;
        document.getElementById('panel-' + panel).classList.add('active');

        // Load data for panel if needed
        if (panel === 'users') loadUsers();
        if (panel === 'posts') loadPosts();
      });
    });

    // Load stats
    async function loadStats() {
      try {
        const resp = await fetch('/api/admin/stats', {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        const data = await resp.json();

        if (data.success) {
          document.getElementById('stat-users').textContent = data.data.users.total.toLocaleString();
          document.getElementById('stat-users-24h').textContent = '+' + data.data.users.last24h;
          document.getElementById('stat-posts').textContent = data.data.posts.total.toLocaleString();
          document.getElementById('stat-posts-24h').textContent = '+' + data.data.posts.last24h;
          document.getElementById('stat-likes').textContent = data.data.engagement.totalLikes.toLocaleString();
          document.getElementById('stat-reposts').textContent = data.data.engagement.totalReposts.toLocaleString();
          document.getElementById('stat-banned').textContent = data.data.users.banned;
          document.getElementById('stat-takedowns').textContent = data.data.posts.takenDown;
          document.getElementById('stats-updated').textContent = new Date(data.data.generatedAt).toLocaleString();

          document.getElementById('stats-loading').style.display = 'none';
          document.getElementById('stats-container').style.display = 'block';
        }
      } catch (e) {
        console.error('Error loading stats:', e);
        document.getElementById('stats-loading').textContent = 'Error loading statistics';
      }
    }

    function refreshStats() {
      document.getElementById('stats-loading').style.display = 'block';
      document.getElementById('stats-container').style.display = 'none';
      loadStats();
    }

    // Load users
    async function loadUsers(offset = 0) {
      currentUserOffset = offset;
      const search = document.getElementById('user-search').value;
      const filter = document.getElementById('user-filter').value;

      document.getElementById('users-loading').style.display = 'block';
      document.getElementById('users-container').innerHTML = '';

      try {
        let url = '/api/admin/users?limit=20&offset=' + offset;
        if (search) url += '&q=' + encodeURIComponent(search);
        if (filter) url += '&filter=' + filter;

        const resp = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        const data = await resp.json();

        document.getElementById('users-loading').style.display = 'none';

        if (data.success && data.data.users.length > 0) {
          const container = document.getElementById('users-container');
          container.innerHTML = data.data.users.map(user => renderUserRow(user)).join('');

          // Pagination
          renderPagination('users', data.data.total, data.data.limit, offset);
        } else {
          document.getElementById('users-container').innerHTML = '<div class="loading">No users found</div>';
        }
      } catch (e) {
        console.error('Error loading users:', e);
        document.getElementById('users-loading').textContent = 'Error loading users';
      }
    }

    function renderUserRow(user) {
      const badges = [];
      if (user.isAdmin) badges.push('<span class="badge badge-admin">Admin</span>');
      if (user.isBanned) badges.push('<span class="badge badge-banned">Banned</span>');
      if (user.isVerified) badges.push('<span class="badge badge-verified">Verified</span>');

      const avatarHtml = user.avatarUrl
        ? '<img src="' + user.avatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + user.avatarUrl + '" data-zoomable="true" style="width:48px;height:48px;" alt="" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="avatar" style="width:48px;height:48px;background:var(--primary);"></div>';

      return '<div class="user-row">' +
        avatarHtml +
        '<div class="user-info">' +
          '<div class="user-name">' + escapeHtml(user.displayName || user.handle) + '</div>' +
          '<div class="user-handle">@' + user.handle + '</div>' +
          '<div class="user-badges">' + badges.join('') + '</div>' +
        '</div>' +
        '<div class="action-buttons">' +
          '<a href="/u/' + user.handle + '" class="btn btn-secondary" target="_blank">View</a>' +
          (user.isBanned
            ? '<button class="btn btn-success" onclick="unbanUser(\\'' + user.handle + '\\')">Unban</button>'
            : '<button class="btn btn-danger" onclick="showBanModal(\\'' + user.handle + '\\')">Ban</button>') +
        '</div>' +
      '</div>';
    }

    function searchUsers() {
      loadUsers(0);
    }

    // Load posts
    async function loadPosts(offset = 0) {
      currentPostOffset = offset;
      const search = document.getElementById('post-search').value;
      const filter = document.getElementById('post-filter').value;

      document.getElementById('posts-loading').style.display = 'block';
      document.getElementById('posts-container').innerHTML = '';

      try {
        let url = '/api/admin/posts?limit=20&offset=' + offset;
        if (search) url += '&q=' + encodeURIComponent(search);
        if (filter) url += '&filter=' + filter;

        const resp = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        const data = await resp.json();

        document.getElementById('posts-loading').style.display = 'none';

        if (data.success && data.data.posts.length > 0) {
          const container = document.getElementById('posts-container');
          container.innerHTML = data.data.posts.map(post => renderPostRow(post)).join('');

          // Pagination
          renderPagination('posts', data.data.total, data.data.limit, offset);
        } else {
          document.getElementById('posts-container').innerHTML = '<div class="loading">No posts found</div>';
        }
      } catch (e) {
        console.error('Error loading posts:', e);
        document.getElementById('posts-loading').textContent = 'Error loading posts';
      }
    }

    function renderPostRow(post) {
      const badges = [];
      if (post.isTakenDown) badges.push('<span class="badge badge-taken-down">Taken Down</span>');
      if (post.isDeleted) badges.push('<span class="badge badge-banned">Deleted</span>');

      const date = new Date(post.createdAt);
      const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

      return '<div class="post-row">' +
        '<div class="post-info">' +
          '<div class="post-author">' + escapeHtml(post.authorDisplayName || post.authorHandle) + ' <span class="post-meta">@' + post.authorHandle + '</span></div>' +
          '<div class="post-meta">' + timeStr + ' · ID: ' + post.id + '</div>' +
          '<div class="post-content-preview">' + escapeHtml(post.content || '') + '</div>' +
          '<div style="margin-top: 8px;">' + badges.join('') + '</div>' +
        '</div>' +
        '<div class="action-buttons">' +
          '<a href="/post/' + post.id + '" class="btn btn-secondary" target="_blank">View</a>' +
          (post.isTakenDown
            ? '<button class="btn btn-success" onclick="restorePost(\\'' + post.id + '\\')">Restore</button>'
            : '<button class="btn btn-danger" onclick="showTakedownModal(\\'' + post.id + '\\')">Take Down</button>') +
          '<button class="btn btn-danger" onclick="deletePost(\\'' + post.id + '\\')">Delete</button>' +
        '</div>' +
      '</div>';
    }

    function searchPosts() {
      loadPosts(0);
    }

    // Pagination
    function renderPagination(type, total, limit, currentOffset) {
      const container = document.getElementById(type + '-pagination');
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.floor(currentOffset / limit) + 1;

      if (totalPages <= 1) {
        container.innerHTML = '';
        return;
      }

      let html = '';
      if (currentPage > 1) {
        html += '<button class="btn btn-secondary" onclick="load' + (type === 'users' ? 'Users' : 'Posts') + '(' + ((currentPage - 2) * limit) + ')">Previous</button>';
      }
      html += '<span style="padding: 8px 16px; color: var(--muted-foreground);">Page ' + currentPage + ' of ' + totalPages + '</span>';
      if (currentPage < totalPages) {
        html += '<button class="btn btn-secondary" onclick="load' + (type === 'users' ? 'Users' : 'Posts') + '(' + (currentPage * limit) + ')">Next</button>';
      }

      container.innerHTML = html;
    }

    // Ban/Unban
    function showBanModal(handle) {
      banTargetHandle = handle;
      document.getElementById('ban-user-handle').textContent = '@' + handle;
      document.getElementById('ban-reason').value = '';
      document.getElementById('ban-modal').classList.remove('hidden');
    }

    function closeBanModal() {
      document.getElementById('ban-modal').classList.add('hidden');
      banTargetHandle = '';
    }

    async function confirmBan() {
      const reason = document.getElementById('ban-reason').value.trim();
      if (!reason) {
        alert('Please provide a reason for the ban');
        return;
      }

      try {
        const resp = await fetch('/api/moderation/users/' + banTargetHandle + '/ban', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        });
        const data = await resp.json();

        if (data.success) {
          closeBanModal();
          loadUsers(currentUserOffset);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error banning user');
      }
    }

    async function unbanUser(handle) {
      if (!confirm('Unban @' + handle + '?')) return;

      try {
        const resp = await fetch('/api/moderation/users/' + handle + '/unban', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        const data = await resp.json();

        if (data.success) {
          loadUsers(currentUserOffset);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error unbanning user');
      }
    }

    // Takedown/Restore
    function showTakedownModal(postId) {
      takedownTargetId = postId;
      document.getElementById('takedown-post-id').textContent = postId;
      document.getElementById('takedown-reason').value = '';
      document.getElementById('takedown-modal').classList.remove('hidden');
    }

    function closeTakedownModal() {
      document.getElementById('takedown-modal').classList.add('hidden');
      takedownTargetId = '';
    }

    async function confirmTakedown() {
      const reason = document.getElementById('takedown-reason').value.trim();

      try {
        const resp = await fetch('/api/moderation/posts/' + takedownTargetId + '/takedown', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: reason || 'Removed by moderator' })
        });
        const data = await resp.json();

        if (data.success) {
          closeTakedownModal();
          loadPosts(currentPostOffset);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error taking down post');
      }
    }

    async function restorePost(postId) {
      if (!confirm('Restore this post?')) return;

      try {
        const resp = await fetch('/api/admin/posts/' + postId + '/restore', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        const data = await resp.json();

        if (data.success) {
          loadPosts(currentPostOffset);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error restoring post');
      }
    }

    async function deletePost(postId) {
      if (!confirm('Permanently delete this post? This cannot be undone.')) return;

      try {
        const resp = await fetch('/api/admin/posts/' + postId, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        const data = await resp.json();

        if (data.success) {
          loadPosts(currentPostOffset);
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error deleting post');
      }
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Initialize
    async function init() {
      const isAdmin = await checkAdmin();
      if (isAdmin) {
        loadStats();
      }
    }

    init();
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
