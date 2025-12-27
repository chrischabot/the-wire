import { getBottomNavHtml } from "../shared/bottom-nav";
import { getCompletePostScript } from "../shared/post-renderer";

export function getSearchPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search / The Wire</title>
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

      <button class="post-button" onclick="window.location.href='/home'">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header" style="display: flex; align-items: center; gap: 16px;">
        <button onclick="history.back()" style="background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; display: flex;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </button>
        <h2>Search</h2>
      </div>

      <!-- Search Input -->
      <div class="search-header">
        <div class="search-box" style="margin: 0;">
          <input type="text" id="search-input" class="search-input" placeholder="Search posts and people" autofocus>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab active" data-type="top">Top</button>
        <button class="tab" data-type="people">People</button>
      </div>

      <!-- Results -->
      <div id="search-results">
        <div class="empty-state" id="initial-state">
          <p>Try searching for posts or people</p>
        </div>
      </div>
    </div>

    ${getBottomNavHtml()}
    <!-- Right Sidebar -->
    <div class="sidebar-right">
      <div class="widget-box">
        <div class="widget-header">Search tips</div>
        <div class="widget-item">
          <div class="widget-item-meta">Find people</div>
          <div class="widget-item-title">Search by @handle or name</div>
        </div>
        <div class="widget-item">
          <div class="widget-item-meta">Find posts</div>
          <div class="widget-item-title">Search for keywords in posts</div>
        </div>
      </div>
    </div>
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const tabs = document.querySelectorAll('.tab');
    let currentType = 'top';
    let currentQuery = '';
    let isLoading = false;
    let currentUser = null;

    // Set profile link and get current user
    async function initPage() {
      try {
        if (auth.isAuthenticated()) {
          const response = await auth.me();
          if (response.success) {
            currentUser = response.data;
            document.querySelectorAll('#profile-nav, #bottom-profile-nav').forEach(el => el.href = '/u/' + response.data.handle);
            postConfig.currentUserHandle = currentUser.handle;
            postConfig.currentUserId = currentUser.id;
          }
        }
      } catch (error) {
        console.error('Error getting profile:', error);
      }

      // Get query from URL
      const urlParams = new URLSearchParams(window.location.search);
      const initialQuery = urlParams.get('q');
      if (initialQuery) {
        searchInput.value = initialQuery;
        performSearch(initialQuery, currentType);
      }
    }
    initPage();

    ${getCompletePostScript({
      containerId: "search-results",
      showDropdownMenu: true,
      showInteractiveActions: true,
      enableLinkCards: true,
      showRepostIndicator: true,
    })}

    // Tab click handler
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentType = tab.dataset.type;
        if (currentQuery) {
          performSearch(currentQuery, currentType);
        }
      });
    });

    // Search on Enter
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          currentQuery = query;
          // Update URL without reload
          const newUrl = '/search?q=' + encodeURIComponent(query);
          history.pushState({}, '', newUrl);
          performSearch(query, currentType);
        }
      }
    });

    async function performSearch(query, type) {
      if (isLoading) return;
      isLoading = true;

      searchResults.innerHTML = '<div class="empty-state">Searching...</div>';

      try {
        const response = await fetch('/api/search?q=' + encodeURIComponent(query) + '&type=' + type + '&limit=20', {
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token'),
          },
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Search failed');
        }

        renderSearchResults(data.data, type);
      } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="empty-state">Error searching. Please try again.</div>';
      } finally {
        isLoading = false;
      }
    }

    function renderSearchResults(data, type) {
      let html = '';

      if (type === 'top') {
        // Show people section at top for 'top' type
        if (data.people && data.people.length > 0) {
          data.people.forEach(person => {
            html += renderPersonCard(person);
          });
        }

        // Show posts using shared component
        if (data.posts && data.posts.length > 0) {
          html += '<div id="search-posts-container">' + data.posts.map(renderPostCard).join('') + '</div>';
        } else if (!data.people || data.people.length === 0) {
          html = '<div class="empty-state">No results found for "' + escapeHtml(data.query) + '"</div>';
        }
      } else if (type === 'people') {
        // People-only view
        if (data.people && data.people.length > 0) {
          data.people.forEach(person => {
            html += renderPersonCard(person);
          });
        } else {
          html = '<div class="empty-state">No people found for "' + escapeHtml(data.query) + '"</div>';
        }
      }

      searchResults.innerHTML = html || '<div class="empty-state">No results found</div>';

      // Attach handlers and load link cards
      if (postConfig.showInteractiveActions) {
        attachPostActionHandlers();
      }
      if (postConfig.enableLinkCards) {
        loadLinkCards();
      }
    }

    function renderPersonCard(person) {
      const isOwnProfile = currentUser && currentUser.id === person.id;
      const avatarHtml = person.avatarUrl
        ? '<img src="' + escapeHtml(person.avatarUrl) + '" class="user-card-avatar" alt="">'
        : '<div class="user-card-avatar user-card-avatar-placeholder"></div>';
      const followsYouBadge = person.followsCurrentUser ? '<span class="follows-you-badge">Follows you</span>' : '';
      const followBtnClass = person.isFollowing ? 'follow-button following' : 'follow-button';
      const followBtnText = person.isFollowing ? 'Following' : 'Follow';

      return '<div class="user-card" onclick="window.location.href=\\'/u/' + escapeHtml(person.handle) + '\\'">' +
        avatarHtml +
        '<div class="user-card-content">' +
          '<div class="user-card-header">' +
            '<span class="user-card-name">' + escapeHtml(person.displayName || person.handle) + '</span>' +
            followsYouBadge +
          '</div>' +
          '<div class="user-card-handle">@' + escapeHtml(person.handle) + '</div>' +
          (person.bio ? '<div class="user-card-bio">' + escapeHtml(person.bio) + '</div>' : '') +
        '</div>' +
        (!isOwnProfile ? '<div class="user-card-actions"><button class="' + followBtnClass + '" onclick="event.stopPropagation(); togglePersonFollow(\\'' + person.id + '\\', this)">' + followBtnText + '</button></div>' : '') +
      '</div>';
    }

    async function togglePersonFollow(userId, button) {
      const isFollowing = button.textContent.trim() === 'Following';

      try {
        const response = await fetch('/api/users/' + userId + '/follow', {
          method: isFollowing ? 'DELETE' : 'POST',
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token'),
          },
        });

        if (response.ok) {
          button.textContent = isFollowing ? 'Follow' : 'Following';
          button.classList.toggle('following', !isFollowing);
        }
      } catch (error) {
        console.error('Error toggling follow:', error);
      }
    }
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
