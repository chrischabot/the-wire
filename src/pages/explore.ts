import { getBottomNavHtml } from "../shared/bottom-nav";
import { getCompletePostScript } from "../shared/post-renderer";

export function getExplorePage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Explore / The Wire</title>
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
      <a href="/explore" class="nav-item active">
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
      <a href="/settings" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </a>
      
      <button class="post-button">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <h2>Explore</h2>
      </div>

      <div id="explore-content">
        <div class="empty-state">Loading trending content...</div>
      </div>
      <div id="pagination-controls" style="display: none; padding: 16px; text-align: center; border-top: 1px solid var(--border-color);">
        <button id="load-more-btn" class="post-button" style="width: auto; padding: 12px 24px;">Load More</button>
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
    // Get current user info for post rendering
    let currentUser = null;
    async function initPage() {
      try {
        if (auth.isAuthenticated()) {
          const response = await auth.me();
          if (response.success) {
            currentUser = response.data;
            document.querySelectorAll('#profile-nav, #bottom-profile-nav').forEach(el => el.href = '/u/' + response.data.handle);
            // Update post config with current user
            postConfig.currentUserHandle = currentUser.handle;
            postConfig.currentUserId = currentUser.id;
          }
        }
      } catch (error) {
        console.error('Error getting profile:', error);
      }
      loadExploreFeed();
    }

    ${getCompletePostScript({
      containerId: "explore-content",
      showDropdownMenu: true,
      showInteractiveActions: true,
      enableLinkCards: true,
      showRepostIndicator: true,
    })}

    let exploreCursor = null;
    let isLoadingMore = false;

    async function loadExploreFeed(append = false) {
      if (isLoadingMore) return;
      isLoadingMore = true;

      const loadMoreBtn = document.getElementById('load-more-btn');
      if (loadMoreBtn && append) {
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
      }

      try {
        const headers = {};
        if (auth.isAuthenticated()) {
          headers['Authorization'] = 'Bearer ' + localStorage.getItem('auth_token');
        }

        let url = '/api/feed/global?limit=20';
        if (append && exploreCursor) {
          url += '&cursor=' + encodeURIComponent(exploreCursor);
        }

        const response = await fetch(url, { headers });
        const data = await response.json();

        const exploreContent = document.getElementById('explore-content');
        const paginationControls = document.getElementById('pagination-controls');

        if (data.success && data.data.posts && data.data.posts.length > 0) {
          if (append) {
            appendPosts(data.data.posts, 'explore-content');
          } else {
            renderPosts(data.data.posts, 'explore-content');
          }

          exploreCursor = data.data.cursor;

          if (data.data.hasMore) {
            paginationControls.style.display = 'block';
          } else {
            paginationControls.style.display = 'none';
          }
        } else if (!append) {
          exploreContent.innerHTML = '<div class="empty-state">No posts to explore yet.</div>';
          paginationControls.style.display = 'none';
        }
      } catch (error) {
        console.error('Error loading explore feed:', error);
        if (!append) {
          document.getElementById('explore-content').innerHTML = '<div class="error">Error loading explore feed</div>';
        }
      } finally {
        isLoadingMore = false;
        if (loadMoreBtn) {
          loadMoreBtn.textContent = 'Load More';
          loadMoreBtn.disabled = false;
        }
      }
    }

    document.getElementById('load-more-btn').addEventListener('click', function() {
      loadExploreFeed(true);
    });

    initPage();
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
