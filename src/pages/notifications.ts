import { getBottomNavHtml } from "../shared/bottom-nav";

export function getNotificationsPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notifications / The Wire</title>
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
      <a href="/notifications" class="nav-item active" id="notifications-nav">
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
      <a href="/settings" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </a>
      
      <button class="post-button">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <h2>Notifications</h2>
      </div>

      <div id="notifications-list">
        <div class="empty-state">Loading notifications...</div>
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

    async function loadNotifications() {
      try {
        const response = await notifications.getAll();
        const notificationsList = document.getElementById('notifications-list');

        if (response.success && response.data.notifications && response.data.notifications.length > 0) {
          notificationsList.innerHTML = response.data.notifications.map(notif => {
            const date = new Date(notif.createdAt);
            const timeStr = formatTimeAgo(date);
            
            let iconSvg = '';
            let notifText = '';
            
            switch (notif.type) {
              case 'like':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#F91880" stroke="#F91880" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
                notifText = notif.actorDisplayName + ' liked your post';
                break;
              case 'repost':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00BA7C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
                notifText = notif.actorDisplayName + ' reposted your post';
                break;
              case 'follow':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1D9BF0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
                notifText = notif.actorDisplayName + ' followed you';
                break;
              case 'reply':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1D9BF0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
                notifText = notif.actorDisplayName + ' replied to your post';
                break;
              case 'mention':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1D9BF0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>';
                notifText = notif.actorDisplayName + ' mentioned you';
                break;
              case 'quote':
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00BA7C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6H3"/><path d="M21 12H8"/><path d="M21 18H8"/><path d="M3 12v6"/></svg>';
                notifText = notif.actorDisplayName + ' quoted your post';
                break;
              default:
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
                notifText = notif.actorDisplayName + ' interacted with you';
            }
            
            const avatarHtml = notif.actorAvatarUrl
              ? '<img src="' + notif.actorAvatarUrl + '" class="avatar avatar-sm media-zoomable" data-fullsrc="' + notif.actorAvatarUrl + '" data-zoomable="true" alt="' + notif.actorDisplayName + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
              : '<div class="avatar avatar-sm" style="background: #1D9BF0;"></div>';

            // Determine link destination
            let href = '#';
            if (notif.type === 'follow') {
              href = '/u/' + notif.actorHandle;
            } else if (notif.postId) {
              href = '/post/' + notif.postId;
            }

            return '<a href="' + href + '" class="post-card" style="text-decoration: none; color: inherit; display: block;">' +
              '<div style="display: flex; gap: 12px;">' +
                '<div style="width: 32px; flex-shrink: 0;">' + iconSvg + '</div>' +
                '<div style="flex: 1;">' +
                  '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">' +
                    avatarHtml +
                    '<strong>' + escapeHtml(notifText) + '</strong>' +
                  '</div>' +
                  '<div style="color: var(--muted-foreground); font-size: 13px;">' + timeStr + '</div>' +
                  (notif.content ? '<div style="margin-top: 8px; color: var(--muted-foreground); font-size: 14px;">' + escapeHtml(notif.content) + '</div>' : '') +
                '</div>' +
              '</div>' +
            '</a>';
          }).join('');
        } else {
          notificationsList.innerHTML = '<div class="empty-state">No notifications yet</div>';
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
        document.getElementById('notifications-list').innerHTML = '<div class="empty-state">No notifications yet</div>';
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatTimeAgo(date) {
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return seconds + 's ago';
      if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
      if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
      if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
      return date.toLocaleDateString();
    }

    loadNotifications();
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
