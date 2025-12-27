import { getBottomNavHtml } from "../shared/bottom-nav";

export function getProfilePage(handle: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@${handle} / The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
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
      <a href="#" class="nav-item active" id="profile-nav">
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
        <h2>@${handle}</h2>
      </div>

      <div id="profile-container">
        <div class="empty-state">Loading profile...</div>
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

  <!-- Image Modal -->
  <div id="image-modal" class="image-modal" onclick="closeImageModal()">
    <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
    <img id="modal-image" src="" alt="Full size image" onclick="event.stopPropagation()">
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    const handle = '${handle}';
    let profileUser = null;
    let currentUserId = null;
    let isFollowing = false;

    async function loadProfile() {
      try {
        if (auth.isAuthenticated()) {
          const meResp = await auth.me();
          if (meResp.success) {
            currentUserId = meResp.data.id;
            const profileNav = document.getElementById('profile-nav');
            if (profileNav) profileNav.href = '/u/' + meResp.data.handle;
          }
        }

        const response = await users.getProfile(handle);
        
        if (response.success) {
          profileUser = response.data;
          
          if (currentUserId && currentUserId !== profileUser.id) {
            const followersResp = await social.getFollowers(handle);
            if (followersResp.success) {
              isFollowing = followersResp.data.followers.some(f => f.id === currentUserId);
            }
          }
          
          renderProfile();
        }
      } catch (error) {
        document.getElementById('profile-container').innerHTML =
          '<div class="error">Error loading profile</div>';
      }
    }

    function renderProfile() {
      const isOwnProfile = currentUserId === profileUser.id;
      
      let actionButton = '';
      if (auth.isAuthenticated()) {
        if (isOwnProfile) {
          actionButton = '<button class="btn-secondary" onclick="window.location.href=\\'/settings\\'">Edit profile</button>';
        } else {
          const followText = isFollowing ? 'Following' : 'Follow';
          const btnClass = isFollowing ? 'btn-secondary' : 'btn-primary';
          actionButton = '<button id="follow-btn" class="' + btnClass + '">' + followText + '</button>';
        }
      }

      const bannerHtml = profileUser.bannerUrl
        ? '<img src="' + profileUser.bannerUrl + '" class="profile-banner profile-banner-clickable media-zoomable" alt="Banner" data-fullsrc="' + profileUser.bannerUrl + '" data-zoomable="true" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="profile-banner"></div>';

      const avatarHtml = profileUser.avatarUrl
        ? '<img src="' + profileUser.avatarUrl + '" class="avatar avatar-lg profile-avatar-clickable media-zoomable" alt="' + profileUser.displayName + '" data-fullsrc="' + profileUser.avatarUrl + '" data-zoomable="true" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="avatar avatar-lg" style="background: #1D9BF0;"></div>';

      const joinDate = new Date(profileUser.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      document.getElementById('profile-container').innerHTML =
        '<div class="profile-header">' +
          bannerHtml +
          '<div class="profile-info">' +
            '<div class="profile-actions-row">' + actionButton + '</div>' +
            avatarHtml +
            '<div class="profile-name">' + escapeHtml(profileUser.displayName) + '</div>' +
            '<div class="profile-handle">@' + profileUser.handle + '</div>' +
            (profileUser.bio ? '<div class="profile-bio">' + escapeHtml(profileUser.bio) + '</div>' : '') +
            '<div class="profile-meta">' +
              (profileUser.location ? '<span>📍 ' + escapeHtml(profileUser.location) + '</span>' : '') +
              '<span>📅 Joined ' + joinDate + '</span>' +
            '</div>' +
            '<div class="profile-stats">' +
              '<a href="/u/' + profileUser.handle + '/following" class="profile-stat"><strong>' + profileUser.followingCount + '</strong> Following</a>' +
              '<a href="/u/' + profileUser.handle + '/followers" class="profile-stat"><strong>' + profileUser.followerCount + '</strong> Followers</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tabs">' +
          '<button class="tab active" data-tab="posts">Posts</button>' +
          '<button class="tab" data-tab="replies">Replies</button>' +
          '<button class="tab" data-tab="media">Media</button>' +
          '<button class="tab" data-tab="likes">Likes</button>' +
        '</div>' +
        '<div id="tab-content"></div>';

      if (!isOwnProfile && auth.isAuthenticated()) {
        setupFollowButton();
      }

      setupTabs();
      loadTabContent('posts');
    }

    let currentTab = 'posts';

    function setupTabs() {
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = tab.dataset.tab;
          if (tabName === currentTab) return;

          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          currentTab = tabName;
          loadTabContent(tabName);
        });
      });
    }

    async function loadTabContent(tabName) {
      const container = document.getElementById('tab-content');
      container.innerHTML = '<div class="empty-state">Loading...</div>';

      try {
        let endpoint = '/api/users/' + handle + '/posts?limit=20';
        if (tabName === 'replies') endpoint = '/api/users/' + handle + '/replies?limit=20';
        else if (tabName === 'media') endpoint = '/api/users/' + handle + '/media?limit=20';
        else if (tabName === 'likes') endpoint = '/api/users/' + handle + '/likes?limit=20';

        const response = await fetch(endpoint);
        const data = await response.json();

        const posts = data.success && data.data && data.data.posts ? data.data.posts : [];
        if (posts.length > 0) {
          container.innerHTML = posts.map(post => renderPostCard(post)).join('');
          setupLikeButtons();
          loadLinkCards();
        } else {
          const emptyMessages = {
            posts: 'No posts yet',
            replies: 'No replies yet',
            media: 'No media posts yet',
            likes: 'No liked posts yet'
          };
          container.innerHTML = '<div class="empty-state">' + emptyMessages[tabName] + '</div>';
        }
      } catch (error) {
        console.error('Error loading ' + tabName + ':', error);
        container.innerHTML = '<div class="error">Error loading content</div>';
      }
    }

    function renderQuotedPost(originalPost) {
      if (!originalPost) return '';

      const mediaHtml = originalPost.mediaUrls && originalPost.mediaUrls.length > 0
        ? '<div class="quoted-post-media">' + originalPost.mediaUrls.map(function(url) {
            return '<img src="' + url + '" class="quoted-post-media-item media-zoomable" data-fullsrc="' + url + '" data-zoomable="true" alt="Media" role="button" tabindex="0" onclick="event.stopPropagation()">';
          }).join('') + '</div>'
        : '';

      return '<div class="quoted-post" onclick="event.stopPropagation(); window.location.href=\\'/post/' + originalPost.id + '\\'">' +
        '<div class="quoted-post-header">' +
          '<span class="quoted-post-author">' + escapeHtml(originalPost.authorDisplayName) + '</span>' +
          '<span class="quoted-post-handle">@' + originalPost.authorHandle + '</span>' +
        '</div>' +
        '<div class="quoted-post-content">' + linkifyMentions(escapeHtml(originalPost.content)) + '</div>' +
        mediaHtml +
      '</div>';
    }

    function renderPostCard(post) {
      const likedClass = post.hasLiked ? ' liked' : '';

      // Check if this is a pure repost (no added content)
      const isRepost = !!post.repostOfId;
      const isPureRepost = isRepost && !post.content && post.originalPost;

      // For pure reposts, show original post's author info
      const displayPost = isPureRepost ? post.originalPost : post;
      const displayDate = new Date(displayPost.createdAt);
      const displayTimeStr = formatTimeAgo(displayDate);

      const displayAvatarHtml = displayPost.authorAvatarUrl
        ? '<img src="' + displayPost.authorAvatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + displayPost.authorAvatarUrl + '" data-zoomable="true" alt="' + displayPost.authorDisplayName + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="avatar" style="background: #1D9BF0;"></div>';

      const repostIndicator = isPureRepost
        ? '<div class="repost-indicator"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ' + escapeHtml(post.authorDisplayName) + ' reposted</div>'
        : '';

      // For quote posts, show quoted content; for pure reposts, don't show it again
      const quotedPostHtml = (post.originalPost && !isPureRepost) ? renderQuotedPost(post.originalPost) : '';

      const isOwnPost = currentUserId && profileUser && displayPost.authorId === currentUserId;
      // Check if this is user's own repost
      const isOwnRepost = isPureRepost && currentUserId && post.authorId === currentUserId;

      const removeRepostBtn = isOwnRepost
        ? '<button class="post-dropdown-item" onclick="event.stopPropagation(); removeRepost(\\'' + post.id + '\\')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><line x1="4" y1="4" x2="20" y2="20"/></svg>' +
            'Remove repost' +
          '</button>'
        : '';

      const postMenuHtml = '<div class="post-menu-container">' +
        '<button class="post-more-btn" onclick="event.stopPropagation(); toggleDropdown(\\'' + post.id + '\\', \\'' + displayPost.authorHandle + '\\', ' + isOwnPost + ')" aria-label="More options">' +
          '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"></circle><circle cx="12" cy="12" r="2" fill="currentColor"></circle><circle cx="19" cy="12" r="2" fill="currentColor"></circle></svg>' +
        '</button>' +
        '<div class="post-dropdown" id="dropdown-' + post.id + '" data-author="' + displayPost.authorHandle + '">' +
          removeRepostBtn +
          (isOwnPost
            ? '<button class="post-dropdown-item destructive" onclick="event.stopPropagation(); deletePost(\\'' + post.id + '\\')">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6V4.5C16 3.12 14.88 2 13.5 2h-3C9.11 2 8 3.12 8 4.5V6H3v2h1.06l.81 11.21C4.98 20.78 6.28 22 7.86 22h8.27c1.58 0 2.88-1.22 3-2.79L19.93 8H21V6h-5zm-6-1.5c0-.28.22-.5.5-.5h3c.27 0 .5.22.5.5V6h-4V4.5zm7.13 14.57c-.04.52-.47.93-1 .93H7.86c-.53 0-.96-.41-1-.93L6.07 8h11.85l-.79 11.07z"/></svg>' +
                'Delete' +
              '</button>'
            : '<button class="post-dropdown-item follow-btn" id="follow-btn-' + post.id + '" onclick="event.stopPropagation(); toggleFollowDropdown(\\'' + displayPost.authorHandle + '\\', \\'' + post.id + '\\')">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 11.816c1.355 0 2.872-.15 3.84-1.256.814-.93 1.078-2.368.806-4.392-.38-2.825-2.117-4.512-4.646-4.512S7.734 3.343 7.354 6.168c-.272 2.024-.008 3.462.806 4.392.968 1.107 2.485 1.256 3.84 1.256zM8.84 6.368c.162-1.2.787-3.212 3.16-3.212s2.998 2.013 3.16 3.212c.207 1.55.057 2.627-.45 3.205-.455.52-1.266.743-2.71.743s-2.255-.223-2.71-.743c-.507-.578-.657-1.656-.45-3.205zm11.44 12.868c-.877-3.526-4.282-5.99-8.28-5.99s-7.403 2.464-8.28 5.99c-.172.692-.028 1.4.395 1.94.408.52 1.04.82 1.733.82h12.304c.693 0 1.325-.3 1.733-.82.424-.54.567-1.247.394-1.94zm-1.576 1.016c-.126.16-.316.252-.552.252H5.848c-.235 0-.426-.092-.552-.252-.137-.175-.18-.412-.12-.654.71-2.855 3.517-4.85 6.824-4.85s6.114 1.994 6.824 4.85c.06.242.017.479-.12.654z"/></svg>' +
                '<span class="follow-text">Follow @' + displayPost.authorHandle + '</span>' +
              '</button>' +
              '<button class="post-dropdown-item destructive" onclick="event.stopPropagation(); blockUser(\\'' + displayPost.authorHandle + '\\')">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM4 12c0-4.411 3.589-8 8-8 1.848 0 3.55.633 4.906 1.688L5.688 16.906C4.633 15.55 4 13.848 4 12zm8 8c-1.848 0-3.55-.633-4.906-1.688L18.312 7.094C19.367 8.45 20 10.152 20 12c0 4.411-3.589 8-8 8z"/></svg>' +
                'Block @' + displayPost.authorHandle +
              '</button>'
          ) +
        '</div>' +
      '</div>';

      const linkCardHtml = (!displayPost.mediaUrls || displayPost.mediaUrls.length === 0) && displayPost.content
        ? (function() {
            var firstUrl = extractFirstUrl(displayPost.content);
            return firstUrl ? '<div class="link-card-container" data-url="' + escapeHtml(firstUrl) + '"></div>' : '';
          })()
        : '';

      return repostIndicator + '<div class="post-card" data-post-id="' + post.id + '" onclick="window.location.href=\\'/post/' + (isPureRepost ? displayPost.id : post.id) + '\\'">' +
        '<div class="post-header">' +
          '<a href="/u/' + displayPost.authorHandle + '" onclick="event.stopPropagation()">' + displayAvatarHtml + '</a>' +
          '<div class="post-body">' +
            '<div class="post-header-top">' +
              '<div class="post-author-row">' +
                '<a href="/u/' + displayPost.authorHandle + '" class="post-author" onclick="event.stopPropagation()">' + escapeHtml(displayPost.authorDisplayName) + '</a>' +
                '<a href="/u/' + displayPost.authorHandle + '" class="post-handle" onclick="event.stopPropagation()">@' + displayPost.authorHandle + '</a>' +
                '<span class="post-timestamp">' + displayTimeStr + '</span>' +
              '</div>' +
              postMenuHtml +
            '</div>' +
            (displayPost.content ? '<div class="post-content">' + linkifyMentions(escapeHtml(displayPost.content)) + '</div>' : '') +
            (displayPost.mediaUrls && displayPost.mediaUrls.length > 0 ?
              '<div class="post-media">' + displayPost.mediaUrls.map(function(url) {
                if (url.match(/\\.(mp4|webm|mov)$/i)) {
                  return '<video src="' + url + '" controls class="post-media-item"></video>';
                }
                return '<img src="' + url + '" class="post-media-item media-zoomable" data-fullsrc="' + url + '" data-zoomable="true" alt="Post media" role="button" tabindex="0" onclick="event.stopPropagation()">';
              }).join('') + '</div>' : '') +
            linkCardHtml +
            quotedPostHtml +
            '<div class="post-actions" onclick="event.stopPropagation()">' +
              '<span class="post-action">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                ' ' + (isPureRepost ? (displayPost.replyCount || 0) : post.replyCount) +
              '</span>' +
              '<span class="post-action">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
                ' ' + (isPureRepost ? (displayPost.repostCount || 0) : post.repostCount) +
              '</span>' +
              '<span class="post-action' + likedClass + '" data-action="like" data-post-id="' + (isPureRepost ? displayPost.id : post.id) + '">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="' + (post.hasLiked ? '#f91880' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
                ' <span class="like-count">' + (isPureRepost ? (displayPost.likeCount || 0) : post.likeCount) + '</span>' +
              '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatTimeAgo(date) {
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return seconds + 's';
      if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
      if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
      if (seconds < 604800) return Math.floor(seconds / 86400) + 'd';
      return date.toLocaleDateString();
    }

    function setupFollowButton() {
      const followBtn = document.getElementById('follow-btn');
      if (followBtn) {
        followBtn.addEventListener('click', async () => {
          try {
            if (isFollowing) {
              await social.unfollow(handle);
              followBtn.textContent = 'Follow';
              followBtn.className = 'btn-primary';
              isFollowing = false;
              profileUser.followerCount--;
            } else {
              await social.follow(handle);
              followBtn.textContent = 'Following';
              followBtn.className = 'btn-secondary';
              isFollowing = true;
              profileUser.followerCount++;
            }
            renderProfile();
          } catch (error) {
            alert('Error: ' + error.message);
          }
        });
      }
    }

    function setupLikeButtons() {
      document.querySelectorAll('[data-action="like"]').forEach(btn => {
        btn.addEventListener('click', handleLike);
      });
    }

    async function handleLike(e) {
      e.stopPropagation();
      const btn = e.currentTarget;
      const postId = btn.dataset.postId;
      const isLiked = btn.classList.contains('liked');
      const countEl = btn.querySelector('.like-count');
      let count = parseInt(countEl.textContent) || 0;

      try {
        if (isLiked) {
          await posts.unlike(postId);
          btn.classList.remove('liked');
          count--;
          btn.querySelector('svg').setAttribute('fill', 'none');
        } else {
          await posts.like(postId);
          btn.classList.add('liked');
          count++;
          btn.querySelector('svg').setAttribute('fill', '#f91880');
        }
        countEl.textContent = count;
      } catch (error) {
        console.error('Error toggling like:', error);
      }
    }

    function linkifyMentions(text) {
      if (!text) return '';
      // Unified mention regex: 3-15 chars, alphanumeric + underscore, case insensitive
      let result = text.replace(/@([a-zA-Z0-9_]{3,15})/gi, '<a href="/u/$1" class="mention" onclick="event.stopPropagation()">@$1</a>');
      result = result.replace(/#([a-zA-Z0-9_]+)/g, '<a href="/search?q=%23$1" class="mention" onclick="event.stopPropagation()">#$1</a>');
      result = result.replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" class="link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>');
      return result;
    }

    function extractFirstUrl(text) {
      if (!text) return null;
      var match = text.match(/https?:\\/\\/[^\\s]+/);
      return match ? match[0] : null;
    }

    function getYouTubeId(url) {
      if (!url) return null;
      var match = url.match(/(?:youtube\\.com\\/(?:watch\\?v=|embed\\/)|youtu\\.be\\/)([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }

    function renderYouTubeEmbed(videoId) {
      return '<div class="youtube-embed"><iframe src="https://www.youtube.com/embed/' + videoId + '" allowfullscreen></iframe></div>';
    }

    function renderLinkCard(data, url) {
      var domain = new URL(url).hostname.replace(/^www\\./, '');
      var hasLargeImage = data.image && (data.type === 'summary_large_image' || !data.type || data.type === 'article');
      if (hasLargeImage) {
        return '<a href="' + escapeHtml(url) + '" class="link-card" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">' +
          '<img src="' + escapeHtml(data.image) + '" class="link-card-image" alt="" onerror="this.style.display=\\'none\\'">' +
          '<div class="link-card-body"><div class="link-card-domain">' + escapeHtml(domain) + '</div>' +
            (data.title ? '<div class="link-card-title">' + escapeHtml(data.title) + '</div>' : '') +
            (data.description ? '<div class="link-card-description">' + escapeHtml(data.description) + '</div>' : '') +
          '</div></a>';
      }
      return '<a href="' + escapeHtml(url) + '" class="link-card" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">' +
        '<div class="link-card-body"><div class="link-card-domain">' + escapeHtml(domain) + '</div>' +
          (data.title ? '<div class="link-card-title">' + escapeHtml(data.title) + '</div>' : '') +
          (data.description ? '<div class="link-card-description">' + escapeHtml(data.description) + '</div>' : '') +
        '</div></a>';
    }

    async function loadLinkCards() {
      document.querySelectorAll('.link-card-container').forEach(async (container) => {
        const url = container.dataset.url;
        if (!url) return;
        const videoId = getYouTubeId(url);
        if (videoId) { container.innerHTML = renderYouTubeEmbed(videoId); return; }
        try {
          const response = await fetch('/api/unfurl?url=' + encodeURIComponent(url));
          if (!response.ok) { container.remove(); return; }
          const result = await response.json();
          if (result.success && result.data) { container.innerHTML = renderLinkCard(result.data, url); }
          else { container.remove(); }
        } catch (error) { container.remove(); }
      });
    }

    // Dropdown menu functionality
    let openDropdown = null;
    const followingState = {};

    function closeAllDropdowns() {
      document.querySelectorAll('.post-dropdown.open').forEach(d => d.classList.remove('open'));
      const backdrop = document.getElementById('dropdown-backdrop');
      if (backdrop) backdrop.classList.add('hidden');
      openDropdown = null;
    }

    async function toggleDropdown(postId, authorHandle, isOwnPost) {
      const dropdown = document.getElementById('dropdown-' + postId);
      if (!dropdown) return;
      if (openDropdown === postId) { closeAllDropdowns(); return; }
      closeAllDropdowns();
      dropdown.classList.add('open');
      let backdrop = document.getElementById('dropdown-backdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'dropdown-backdrop';
        backdrop.className = 'dropdown-backdrop';
        backdrop.onclick = closeAllDropdowns;
        document.body.appendChild(backdrop);
      }
      backdrop.classList.remove('hidden');
      openDropdown = postId;

      if (!isOwnPost) {
        const followBtn = document.getElementById('follow-btn-' + postId);
        if (followBtn) {
          const textSpan = followBtn.querySelector('.follow-text');
          if (followingState[authorHandle] === undefined) {
            textSpan.textContent = 'Loading...';
            try {
              const response = await fetch('/api/users/' + authorHandle, { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') } });
              const data = await response.json();
              followingState[authorHandle] = data.data?.isFollowing || false;
            } catch (e) { followingState[authorHandle] = false; }
          }
          updateFollowButtonDropdown(postId, authorHandle, followingState[authorHandle]);
        }
      }
    }

    function updateFollowButtonDropdown(postId, h, isFoll) {
      const btn = document.getElementById('follow-btn-' + postId);
      if (btn) {
        const txt = btn.querySelector('.follow-text');
        txt.textContent = isFoll ? 'Unfollow @' + h : 'Follow @' + h;
        btn.classList.toggle('following', isFoll);
      }
    }

    async function toggleFollowDropdown(h, postId) {
      const btn = document.getElementById('follow-btn-' + postId);
      const txt = btn?.querySelector('.follow-text');
      const curr = followingState[h] || false;
      try {
        if (txt) txt.textContent = 'Loading...';
        await fetch('/api/users/' + h + '/follow', { method: curr ? 'DELETE' : 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') } });
        followingState[h] = !curr;
        updateFollowButtonDropdown(postId, h, followingState[h]);
        closeAllDropdowns();
      } catch (err) { alert('Failed to update follow status'); updateFollowButtonDropdown(postId, h, curr); }
    }

    async function blockUser(h) {
      if (!confirm('Block @' + h + '? They won\\'t be able to see your posts.')) return;
      try {
        await fetch('/api/users/' + h + '/block', { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') } });
        document.querySelectorAll('.post-card').forEach(c => { const d = c.querySelector('.post-dropdown'); if (d && d.dataset.author === h) c.remove(); });
        closeAllDropdowns();
      } catch (err) { alert('Failed to block user'); }
    }

    async function deletePost(postId) {
      if (!confirm('Delete this post?')) return;
      try {
        await fetch('/api/posts/' + postId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') } });
        const el = document.querySelector('[data-post-id="' + postId + '"]');
        if (el) el.remove();
        closeAllDropdowns();
      } catch (err) { alert('Failed to delete post'); }
    }

    async function removeRepost(postId) {
      if (!confirm('Remove this repost?')) return;
      try {
        await fetch('/api/posts/' + postId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') } });
        const el = document.querySelector('[data-post-id="' + postId + '"]');
        if (el) {
          const prev = el.previousElementSibling;
          if (prev && prev.classList.contains('repost-indicator')) prev.remove();
          el.remove();
        }
        closeAllDropdowns();
      } catch (err) { alert('Failed to remove repost'); }
    }

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllDropdowns(); });

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


export function getFollowersPage(handle: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>People following @${handle} / The Wire</title>
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
      <a href="/settings" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </a>

      <button class="post-button" onclick="window.location.href='/home'">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <a href="/u/${handle}" class="back-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </a>
        <div>
          <h2>Followers</h2>
          <p class="text-muted" style="font-size: 13px;">@${handle}</p>
        </div>
      </div>
      <div id="users-list"><div class="empty-state">Loading...</div></div>
    </div>

    ${getBottomNavHtml()}
    <!-- Right Sidebar -->
    <div class="sidebar-right">
      <div class="search-box">
        <input type="text" class="search-input" placeholder="Search" onkeypress="if(event.key==='Enter' && this.value.trim().length >= 2) window.location.href='/search?q='+encodeURIComponent(this.value.trim())">
      </div>
    </div>
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    const handle = '${handle}';
    let currentUserId = null;
    let currentUserHandle = null;
    let currentUserFollowing = new Set();

    async function init() {
      theme.init();
      if (auth.isAuthenticated()) {
        const meResp = await auth.me();
        if (meResp.success) {
          currentUserId = meResp.data.id;
          currentUserHandle = meResp.data.handle;
          document.querySelectorAll('#profile-nav, #bottom-profile-nav').forEach(el => el.href = '/u/' + meResp.data.handle);
          const followingResp = await fetch('/api/users/' + meResp.data.handle + '/following');
          const followingData = await followingResp.json();
          if (followingData.success) {
            followingData.data.following.forEach(u => currentUserFollowing.add(u.id));
          }
        }
      }
      loadUsers();
    }

    async function loadUsers() {
      const container = document.getElementById('users-list');
      try {
        const resp = await fetch('/api/users/' + handle + '/followers');
        const data = await resp.json();
        if (!data.success || data.data.followers.length === 0) {
          container.innerHTML = '<div class="empty-state">No followers yet</div>';
          return;
        }
        const userDetails = await Promise.all(data.data.followers.map(async (u) => {
          const profileResp = await fetch('/api/users/' + u.handle);
          const profileData = await profileResp.json();
          if (profileData.success) {
            return { ...profileData.data, isMutual: currentUserFollowing.has(u.id) };
          }
          return null;
        }));
        const validUsers = userDetails.filter(u => u !== null);
        validUsers.sort((a, b) => (b.isMutual ? 1 : 0) - (a.isMutual ? 1 : 0));
        container.innerHTML = validUsers.map(u => renderUserCard(u)).join('');
      } catch (err) {
        container.innerHTML = '<div class="error">Error loading followers</div>';
      }
    }

    function renderUserCard(user) {
      const mutualBadge = user.isMutual ? '<span class="following-badge">Following</span>' : '';
      const avatarHtml = user.avatarUrl
        ? '<img src="' + user.avatarUrl + '?width=96&quality=80" class="user-card-avatar media-zoomable" data-fullsrc="' + user.avatarUrl + '" data-zoomable="true" alt="" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="user-card-avatar user-card-avatar-placeholder"></div>';
      return '<a href="/u/' + user.handle + '" class="user-card">' +
        avatarHtml +
        '<div class="user-card-content">' +
          '<div class="user-card-header">' +
            '<span class="user-card-name">' + escapeHtml(user.displayName || user.handle) + '</span>' +
          '</div>' +
          '<div class="user-card-handle">@' + user.handle + '</div>' +
          (user.bio ? '<div class="user-card-bio">' + escapeHtml(user.bio) + '</div>' : '') +
        '</div>' +
        mutualBadge +
      '</a>';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
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


export function getFollowingPage(handle: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>People @${handle} follows / The Wire</title>
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
      <a href="/settings" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </a>

      <button class="post-button" onclick="window.location.href='/home'">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <a href="/u/${handle}" class="back-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </a>
        <div>
          <h2>Following</h2>
          <p class="text-muted" style="font-size: 13px;">@${handle}</p>
        </div>
      </div>
      <div id="users-list"><div class="empty-state">Loading...</div></div>
    </div>

    ${getBottomNavHtml()}
    <!-- Right Sidebar -->
    <div class="sidebar-right">
      <div class="search-box">
        <input type="text" class="search-input" placeholder="Search" onkeypress="if(event.key==='Enter' && this.value.trim().length >= 2) window.location.href='/search?q='+encodeURIComponent(this.value.trim())">
      </div>
    </div>
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    const handle = '${handle}';
    let currentUserId = null;
    let currentUserHandle = null;
    let currentUserFollowing = new Set();

    async function init() {
      theme.init();
      if (auth.isAuthenticated()) {
        const meResp = await auth.me();
        if (meResp.success) {
          currentUserId = meResp.data.id;
          currentUserHandle = meResp.data.handle;
          document.querySelectorAll('#profile-nav, #bottom-profile-nav').forEach(el => el.href = '/u/' + meResp.data.handle);
          const followingResp = await fetch('/api/users/' + meResp.data.handle + '/following');
          const followingData = await followingResp.json();
          if (followingData.success) {
            followingData.data.following.forEach(u => currentUserFollowing.add(u.id));
          }
        }
      }
      loadUsers();
    }

    async function loadUsers() {
      const container = document.getElementById('users-list');
      try {
        const resp = await fetch('/api/users/' + handle + '/following');
        const data = await resp.json();
        if (!data.success || data.data.following.length === 0) {
          container.innerHTML = '<div class="empty-state">Not following anyone yet</div>';
          return;
        }
        const userDetails = await Promise.all(data.data.following.map(async (u) => {
          const profileResp = await fetch('/api/users/' + u.handle);
          const profileData = await profileResp.json();
          if (profileData.success) {
            return { ...profileData.data, isMutual: currentUserFollowing.has(u.id) };
          }
          return null;
        }));
        const validUsers = userDetails.filter(u => u !== null);
        validUsers.sort((a, b) => (b.isMutual ? 1 : 0) - (a.isMutual ? 1 : 0));
        container.innerHTML = validUsers.map(u => renderUserCard(u)).join('');
      } catch (err) {
        container.innerHTML = '<div class="error">Error loading following</div>';
      }
    }

    function renderUserCard(user) {
      const mutualBadge = user.isMutual ? '<span class="follows-you-badge">Follows you</span>' : '';
      const avatarHtml = user.avatarUrl
        ? '<img src="' + user.avatarUrl + '?width=96&quality=80" class="user-card-avatar media-zoomable" data-fullsrc="' + user.avatarUrl + '" data-zoomable="true" alt="" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="user-card-avatar user-card-avatar-placeholder"></div>';
      return '<a href="/u/' + user.handle + '" class="user-card">' +
        avatarHtml +
        '<div class="user-card-content">' +
          '<div class="user-card-header">' +
            '<span class="user-card-name">' + escapeHtml(user.displayName || user.handle) + '</span>' +
            mutualBadge +
          '</div>' +
          '<div class="user-card-handle">@' + user.handle + '</div>' +
          (user.bio ? '<div class="user-card-bio">' + escapeHtml(user.bio) + '</div>' : '') +
        '</div>' +
      '</a>';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
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
