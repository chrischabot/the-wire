import { getBottomNavHtml } from "../shared/bottom-nav";

export function getPostPage(postId: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post / The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
</head>
<body>
  <!-- Dropdown backdrop -->
  <div id="dropdown-backdrop" class="dropdown-backdrop hidden"></div>

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

      <button class="post-button">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <button onclick="history.back()" style="background: none; border: none; cursor: pointer; font-size: 20px; margin-right: 24px;">←</button>
        <h2>Post</h2>
      </div>

      <div id="post-container">
        <div class="empty-state">Loading post...</div>
      </div>

      <!-- Reply Composer -->
      <div id="reply-composer" style="display: none;">
        <div class="compose-box reply-compose-box">
          <div id="replying-to" class="replying-to"></div>
          <div class="reply-input-row">
            <img id="reply-avatar" class="avatar media-zoomable" src="" alt="Your avatar" data-zoomable="true" role="button" tabindex="0">
            <form id="reply-form" class="reply-form">
              <textarea
                id="reply-content"
                placeholder="Post your reply"
                maxlength="280"
              ></textarea>
              <div id="reply-media-preview" class="media-preview" style="display: none;">
                <div id="reply-media-preview-content"></div>
                <button type="button" id="reply-remove-media" class="remove-media">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <div class="reply-footer">
                <div class="compose-actions">
                  <input type="file" id="reply-image-upload" accept="image/*" style="display: none;">
                  <button type="button" class="icon-button" id="reply-image-btn" title="Add image">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  </button>
                  <input type="file" id="reply-video-upload" accept="video/*" style="display: none;">
                  <button type="button" class="icon-button" id="reply-video-btn" title="Add video">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
                  </button>
                </div>
                <div class="reply-submit-area">
                  <span id="reply-char-counter" class="char-counter">0 / 280</span>
                  <button type="submit" class="tweet-button" id="reply-btn" disabled>Reply</button>
                </div>
              </div>
            </form>
          </div>
          <div id="reply-error" class="error"></div>
          <div id="reply-success" class="success"></div>
        </div>
      </div>

      <!-- Replies List -->
      <div id="replies-container"></div>
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
    const postId = '${postId}';
    let currentUser = null;
    const followingState = {};

    // =====================================================
    // DROPDOWN MENU FUNCTIONS (must be defined first)
    // =====================================================

    function renderPostMenu(menuPostId, authorHandle, isOwnPost) {
      if (!auth.isAuthenticated()) return '';

      return '<div class="post-menu-container">' +
        '<button class="post-more-btn" onclick="event.stopPropagation(); toggleDropdown(\\'' + menuPostId + '\\', \\'' + authorHandle + '\\', ' + isOwnPost + ')" aria-label="More options">' +
          '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"></circle><circle cx="12" cy="12" r="2" fill="currentColor"></circle><circle cx="19" cy="12" r="2" fill="currentColor"></circle></svg>' +
        '</button>' +
        '<div class="post-dropdown" id="dropdown-' + menuPostId + '" data-author="' + authorHandle + '">' +
          (isOwnPost
            ? '<button class="post-dropdown-item destructive" onclick="event.stopPropagation(); deletePost(\\'' + menuPostId + '\\')">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6V4.5C16 3.12 14.88 2 13.5 2h-3C9.11 2 8 3.12 8 4.5V6H3v2h1.06l.81 11.21C4.98 20.78 6.28 22 7.86 22h8.27c1.58 0 2.88-1.22 3-2.79L19.93 8H21V6h-5zm-6-1.5c0-.28.22-.5.5-.5h3c.27 0 .5.22.5.5V6h-4V4.5zm7.13 14.57c-.04.52-.47.93-1 .93H7.86c-.53 0-.96-.41-1-.93L6.07 8h11.85l-.79 11.07z"/></svg>' +
                'Delete' +
              '</button>'
            : '<button class="post-dropdown-item follow-btn" id="follow-btn-' + menuPostId + '" onclick="event.stopPropagation(); toggleFollow(\\'' + authorHandle + '\\', \\'' + menuPostId + '\\')">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 11.816c1.355 0 2.872-.15 3.84-1.256.814-.93 1.078-2.368.806-4.392-.38-2.825-2.117-4.512-4.646-4.512S7.734 3.343 7.354 6.168c-.272 2.024-.008 3.462.806 4.392.968 1.107 2.485 1.256 3.84 1.256zM8.84 6.368c.162-1.2.787-3.212 3.16-3.212s2.998 2.013 3.16 3.212c.207 1.55.057 2.627-.45 3.205-.455.52-1.266.743-2.71.743s-2.255-.223-2.71-.743c-.507-.578-.657-1.656-.45-3.205zm11.44 12.868c-.877-3.526-4.282-5.99-8.28-5.99s-7.403 2.464-8.28 5.99c-.172.692-.028 1.4.395 1.94.408.52 1.04.82 1.733.82h12.304c.693 0 1.325-.3 1.733-.82.424-.54.567-1.247.394-1.94zm-1.576 1.016c-.126.16-.316.252-.552.252H5.848c-.235 0-.426-.092-.552-.252-.137-.175-.18-.412-.12-.654.71-2.855 3.517-4.85 6.824-4.85s6.114 1.994 6.824 4.85c.06.242.017.479-.12.654z"/></svg>' +
                '<span class="follow-text">Follow @' + authorHandle + '</span>' +
              '</button>' +
              '<button class="post-dropdown-item destructive" onclick="event.stopPropagation(); blockUser(\\'' + authorHandle + '\\')">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM4 12c0-4.411 3.589-8 8-8 1.848 0 3.55.633 4.906 1.688L5.688 16.906C4.633 15.55 4 13.848 4 12zm8 8c-1.848 0-3.55-.633-4.906-1.688L18.312 7.094C19.367 8.45 20 10.152 20 12c0 4.411-3.589 8-8 8z"/></svg>' +
                'Block @' + authorHandle +
              '</button>'
          ) +
        '</div>' +
      '</div>';
    }

    function toggleDropdown(menuPostId, authorHandle, isOwnPost) {
      const dropdown = document.getElementById('dropdown-' + menuPostId);
      const backdrop = document.getElementById('dropdown-backdrop');
      if (!dropdown) { console.error('Dropdown not found:', menuPostId); return; }
      const wasOpen = dropdown.classList.contains('open');

      closeAllDropdowns();

      if (!wasOpen) {
        dropdown.classList.add('open');
        if (backdrop) backdrop.classList.remove('hidden');

        if (!isOwnPost && followingState[authorHandle] === undefined) {
          checkFollowingState(authorHandle, menuPostId);
        } else if (!isOwnPost) {
          updateFollowButton(menuPostId, authorHandle, followingState[authorHandle]);
        }
      }
    }

    function closeAllDropdowns() {
      document.querySelectorAll('.post-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
      const backdrop = document.getElementById('dropdown-backdrop');
      if (backdrop) backdrop.classList.add('hidden');
    }

    async function checkFollowingState(handle, menuPostId) {
      try {
        const response = await users.getProfile(handle);
        if (response.success) {
          followingState[handle] = response.data.isFollowing || false;
          updateFollowButton(menuPostId, handle, followingState[handle]);
        }
      } catch (e) {
        console.error('Error checking following state:', e);
      }
    }

    function updateFollowButton(menuPostId, handle, isFollowing) {
      const btn = document.getElementById('follow-btn-' + menuPostId);
      if (btn) {
        const textEl = btn.querySelector('.follow-text');
        if (textEl) {
          textEl.textContent = (isFollowing ? 'Unfollow @' : 'Follow @') + handle;
        }
      }
    }

    async function toggleFollow(handle, menuPostId) {
      const isCurrentlyFollowing = followingState[handle] || false;

      try {
        if (isCurrentlyFollowing) {
          await social.unfollow(handle);
          followingState[handle] = false;
        } else {
          await social.follow(handle);
          followingState[handle] = true;
        }
        updateFollowButton(menuPostId, handle, followingState[handle]);
        closeAllDropdowns();
      } catch (e) {
        console.error('Error toggling follow:', e);
        alert('Could not ' + (isCurrentlyFollowing ? 'unfollow' : 'follow') + ' user');
      }
    }

    async function blockUser(handle) {
      if (!confirm('Are you sure you want to block @' + handle + '? You will no longer see their posts.')) {
        return;
      }

      try {
        await social.block(handle);
        closeAllDropdowns();
        alert('@' + handle + ' has been blocked.');
        window.location.href = '/home';
      } catch (e) {
        console.error('Error blocking user:', e);
        alert('Could not block user');
      }
    }

    async function deletePost(delPostId) {
      if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
      }

      try {
        const response = await posts.delete(delPostId);
        if (response.success) {
          closeAllDropdowns();
          if (delPostId === postId) {
            window.location.href = '/home';
          } else {
            loadReplies(false);
          }
        }
      } catch (e) {
        console.error('Error deleting post:', e);
        alert('Could not delete post');
      }
    }

    // Close dropdowns on backdrop click or ESC
    document.addEventListener('click', function(e) {
      if (e.target && e.target.id === 'dropdown-backdrop') {
        closeAllDropdowns();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeAllDropdowns();
    });

    // =====================================================
    // END DROPDOWN MENU FUNCTIONS
    // =====================================================

    function renderQuotedPostDetail(originalPost) {
      if (!originalPost) return '';

      const mediaHtml = originalPost.mediaUrls && originalPost.mediaUrls.length > 0
        ? '<div class="quoted-post-media">' + originalPost.mediaUrls.map(function(url) {
            if (url.match(/\\.(mp4|webm|mov)$/i)) {
              return '<video src="' + url + '" controls></video>';
            }
            return '<img src="' + url + '" alt="Media">';
          }).join('') + '</div>'
        : '';

      return '<div class="quoted-post" onclick="window.location.href=\\'/post/' + originalPost.id + '\\'">' +
        '<div class="quoted-post-header">' +
          '<span class="quoted-post-author">' + escapeHtml(originalPost.authorDisplayName) + '</span>' +
          '<span class="quoted-post-handle">@' + originalPost.authorHandle + '</span>' +
        '</div>' +
        '<div class="quoted-post-content">' + linkifyMentions(escapeHtml(originalPost.content)) + '</div>' +
        mediaHtml +
      '</div>';
    }

    async function loadPost() {
      try {
        const response = await posts.get(postId);

        if (response.success) {
          const post = response.data;
          const date = new Date(post.createdAt);
          const fullTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' · ' +
                          date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

          const avatarHtml = post.authorAvatarUrl
            ? '<img src="' + post.authorAvatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + post.authorAvatarUrl + '" data-zoomable="true" alt="' + post.authorDisplayName + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
            : '<div class="avatar" style="background: #1D9BF0;"></div>';

          const likedClass = post.hasLiked ? ' liked' : '';
          const repostedClass = post.hasReposted ? ' reposted' : '';

          // Check if this is a repost
          const isRepost = !!post.repostOfId;
          const quotedPostHtml = post.originalPost ? renderQuotedPostDetail(post.originalPost) : '';
          const repostIndicator = isRepost
            ? '<div class="repost-indicator" style="padding-left: 0; margin-bottom: 12px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ' + escapeHtml(post.authorDisplayName) + ' reposted</div>'
            : '';

          const isOwnPost = currentUser && currentUser.handle && currentUser.handle.toLowerCase() === post.authorHandle.toLowerCase();
          const mainPostMenuHtml = renderPostMenu(post.id, post.authorHandle, isOwnPost);

          document.getElementById('post-container').innerHTML =
            '<div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">' +
              repostIndicator +
              '<div class="post-header">' +
                '<a href="/u/' + post.authorHandle + '">' + avatarHtml + '</a>' +
                '<div class="post-body">' +
                  '<div class="post-header-top">' +
                    '<div class="post-author-row">' +
                      '<a href="/u/' + post.authorHandle + '" class="post-author">' + escapeHtml(post.authorDisplayName) + '</a>' +
                      '<a href="/u/' + post.authorHandle + '" class="post-handle">@' + post.authorHandle + '</a>' +
                    '</div>' +
                    mainPostMenuHtml +
                  '</div>' +
                '</div>' +
              '</div>' +
              (post.content ? '<div class="post-content" style="font-size: 23px; line-height: 28px; margin: 12px 0;">' + linkifyMentions(escapeHtml(post.content)) + '</div>' : '') +
              (post.mediaUrls && post.mediaUrls.length > 0 ? '<div class="post-media">' + post.mediaUrls.map(function(url) {
                if (url.match(/\\.(mp4|webm|mov)$/i)) {
                  return '<video src="' + url + '" controls class="post-media-item"></video>';
                }
                return '<img src="' + url + '" class="post-media-item media-zoomable" data-fullsrc="' + url + '" data-zoomable="true" alt="Post media" role="button" tabindex="0" onclick="event.stopPropagation()">';
              }).join('') + '</div>' : '') +
              (function() {
                var firstUrl = (!post.mediaUrls || post.mediaUrls.length === 0) ? extractFirstUrl(post.content) : null;
                return firstUrl ? '<div class="link-card-container" data-url="' + escapeHtml(firstUrl) + '"></div>' : '';
              })() +
              quotedPostHtml +
              '<div style="color: #536471; font-size: 15px; margin: 12px 0; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">' + fullTime + '</div>' +
              '<div class="post-actions" style="padding: 12px 0;">' +
                '<span class="post-action">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                  ' <span id="reply-count">' + post.replyCount + '</span>' +
                '</span>' +
                '<span class="post-action' + repostedClass + '" id="repost-btn">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
                  ' <span id="repost-count">' + post.repostCount + '</span>' +
                '</span>' +
                '<span class="post-action' + likedClass + '" id="like-btn">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
                  ' <span id="like-count">' + post.likeCount + '</span>' +
                '</span>' +
              '</div>' +
            '</div>';

          if (auth.isAuthenticated()) {
            document.getElementById('like-btn').addEventListener('click', handleLike);
            document.getElementById('repost-btn').addEventListener('click', handleRepost);
            document.getElementById('reply-composer').style.display = 'block';
            setupReplyComposer();

            const shouldFocusReply = new URLSearchParams(window.location.search).get('reply') === 'true';
            if (shouldFocusReply) {
              setTimeout(function() {
                const replyTextarea = document.getElementById('reply-content');
                if (replyTextarea) {
                  replyTextarea.focus();
                  replyTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }

            // Populate "Replying to" with author and mentioned users
            const replyingToEl = document.getElementById('replying-to');
            const mentionedUsers = new Set();
            mentionedUsers.add(post.authorHandle);

            // Extract @mentions from post content (unified regex: 3-15 chars, case insensitive)
            const mentionMatches = post.content.match(/@([a-zA-Z0-9_]{3,15})/gi);
            if (mentionMatches) {
              mentionMatches.forEach(m => mentionedUsers.add(m.substring(1)));
            }

            const handles = Array.from(mentionedUsers);
            const links = handles.map(h => '<a href="/u/' + h + '" class="replying-to-link">@' + h + '</a>');
            replyingToEl.innerHTML = 'Replying to ' + links.join(' ');
          }
          
          loadReplies(false);
        }
      } catch (error) {
        document.getElementById('post-container').innerHTML =
          '<div class="error">Error loading post</div>';
      }
    }

    async function loadUserProfile() {
      if (!auth.isAuthenticated()) return;

      try {
        const response = await auth.me();
        if (response.success) {
          document.querySelectorAll('#profile-nav, #bottom-profile-nav').forEach(el => el.href = '/u/' + response.data.handle);

          const profileResp = await users.getProfile(response.data.handle);
          if (profileResp.success) {
            currentUser = profileResp.data;

            const replyAvatar = document.getElementById('reply-avatar');
            if (currentUser.avatarUrl) {
              replyAvatar.src = currentUser.avatarUrl;
              replyAvatar.setAttribute('data-fullsrc', currentUser.avatarUrl);
            } else {
              replyAvatar.style.display = 'none';
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    }

    function setupReplyComposer() {
      const replyTextarea = document.getElementById('reply-content');
      const replyCounter = document.getElementById('reply-char-counter');
      const replyBtn = document.getElementById('reply-btn');
      const replyForm = document.getElementById('reply-form');
      const replyError = document.getElementById('reply-error');
      const replySuccess = document.getElementById('reply-success');

      // Reply media upload handling
      let replySelectedMedia = null;
      const replyImageUpload = document.getElementById('reply-image-upload');
      const replyVideoUpload = document.getElementById('reply-video-upload');
      const replyImageBtn = document.getElementById('reply-image-btn');
      const replyVideoBtn = document.getElementById('reply-video-btn');
      const replyMediaPreview = document.getElementById('reply-media-preview');
      const replyMediaPreviewContent = document.getElementById('reply-media-preview-content');
      const replyRemoveMediaBtn = document.getElementById('reply-remove-media');

      replyImageBtn.addEventListener('click', () => replyImageUpload.click());
      replyVideoBtn.addEventListener('click', () => replyVideoUpload.click());

      replyImageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          replySelectedMedia = { file, type: 'image' };
          showReplyMediaPreview(file, 'image');
        }
      });

      replyVideoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          replySelectedMedia = { file, type: 'video' };
          showReplyMediaPreview(file, 'video');
        }
      });

      function showReplyMediaPreview(file, type) {
        const url = URL.createObjectURL(file);
        if (type === 'image') {
          replyMediaPreviewContent.innerHTML = '<img src="' + url + '" alt="Preview">';
        } else {
          replyMediaPreviewContent.innerHTML = '<video src="' + url + '" controls></video>';
        }
        replyMediaPreview.style.display = 'flex';
        replyBtn.disabled = false;
      }

      replyRemoveMediaBtn.addEventListener('click', () => {
        replySelectedMedia = null;
        replyMediaPreview.style.display = 'none';
        replyMediaPreviewContent.innerHTML = '';
        replyImageUpload.value = '';
        replyVideoUpload.value = '';
        if (replyTextarea.value.length === 0) {
          replyBtn.disabled = true;
        }
      });

      async function uploadReplyMedia(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/media/upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token'),
          },
          body: formData,
        });

        const data = await response.json();
        if (data.success) {
          return data.data.url;
        }
        throw new Error(data.error || 'Upload failed');
      }

      replyTextarea.addEventListener('input', () => {
        const length = replyTextarea.value.length;
        replyCounter.textContent = length + ' / 280';
        replyBtn.disabled = length === 0 && !replySelectedMedia;
      });

      replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const content = replyTextarea.value.trim();
        if (!content && !replySelectedMedia) return;

        replyError.textContent = '';
        replySuccess.textContent = '';
        replyBtn.disabled = true;
        replyBtn.textContent = 'Replying...';

        try {
          let mediaUrls = [];

          // Upload media if selected
          if (replySelectedMedia) {
            replyBtn.textContent = 'Uploading...';
            const mediaUrl = await uploadReplyMedia(replySelectedMedia.file);
            mediaUrls = [mediaUrl];
          }

          const response = await posts.create(content, mediaUrls, postId, null);

          if (response.success) {
            replySuccess.textContent = 'Reply posted!';
            replyTextarea.value = '';
            replyCounter.textContent = '0 / 280';
            replySelectedMedia = null;
            replyMediaPreview.style.display = 'none';
            replyMediaPreviewContent.innerHTML = '';
            replyImageUpload.value = '';
            replyVideoUpload.value = '';

            const replyCountEl = document.getElementById('reply-count');
            if (replyCountEl) {
              replyCountEl.textContent = parseInt(replyCountEl.textContent) + 1;
            }

            setTimeout(() => {
              loadReplies(false);
              replySuccess.textContent = '';
            }, 500);
          }
        } catch (error) {
          replyError.textContent = error.message;
        } finally {
          replyBtn.disabled = false;
          replyBtn.textContent = 'Reply';
        }
      });
    }

    let repliesCursor = null;
    let hasMoreReplies = false;
    let isLoadingReplies = false;

    function renderReplyCard(reply) {
      const date = new Date(reply.createdAt);
      const timeStr = formatTimeAgo(date);
      
      const avatarHtml = reply.authorAvatarUrl
        ? '<img src="' + reply.authorAvatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + reply.authorAvatarUrl + '" data-zoomable="true" alt="' + reply.authorDisplayName + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="avatar" style="background: #1D9BF0;"></div>';
      
      const likedClass = reply.hasLiked ? ' liked' : '';
      const isOwnReply = currentUser && currentUser.handle && currentUser.handle.toLowerCase() === reply.authorHandle.toLowerCase();

      return '<div class="post-card" data-post-id="' + reply.id + '" onclick="window.location.href=\\'/post/' + reply.id + '\\'">' +
        '<div class="post-header">' +
          '<a href="/u/' + reply.authorHandle + '" onclick="event.stopPropagation()">' + avatarHtml + '</a>' +
          '<div class="post-body">' +
            '<div class="post-header-top">' +
              '<div class="post-author-row">' +
                '<a href="/u/' + reply.authorHandle + '" class="post-author" onclick="event.stopPropagation()">' + escapeHtml(reply.authorDisplayName) + '</a>' +
                '<a href="/u/' + reply.authorHandle + '" class="post-handle" onclick="event.stopPropagation()">@' + reply.authorHandle + '</a>' +
                '<span class="post-timestamp">' + timeStr + '</span>' +
              '</div>' +
              renderPostMenu(reply.id, reply.authorHandle, isOwnReply) +
            '</div>' +
            '<div class="post-content">' + linkifyMentions(escapeHtml(reply.content)) + '</div>' +
            (reply.mediaUrls && reply.mediaUrls.length > 0 ?
              '<div class="post-media">' + reply.mediaUrls.map(url =>
                '<img src="' + url + '" class="post-media-item media-zoomable" data-fullsrc="' + url + '" data-zoomable="true" alt="Reply media" role="button" tabindex="0" onclick="event.stopPropagation()">'
              ).join('') + '</div>' : '') +
            '<div class="post-actions" onclick="event.stopPropagation()">' +
              '<span class="post-action" onclick="window.location.href=\\'/post/' + reply.id + '\\'" title="Reply">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                ' ' + reply.replyCount +
              '</span>' +
              '<span class="post-action" data-action="repost" data-post-id="' + reply.id + '">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
                ' <span class="repost-count">' + reply.repostCount + '</span>' +
              '</span>' +
              '<span class="post-action' + likedClass + '" data-action="like" data-post-id="' + reply.id + '">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
                ' <span class="like-count">' + reply.likeCount + '</span>' +
              '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    async function loadReplies(append) {
      if (isLoadingReplies) return;
      isLoadingReplies = true;

      try {
        const repliesContainer = document.getElementById('replies-container');
        
        if (!append) {
          repliesCursor = null;
          repliesContainer.innerHTML = '<div class="empty-state">Loading...</div>';
        }

        const url = '/api/posts/' + postId + '/replies' + (repliesCursor ? '?cursor=' + repliesCursor : '');
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
          const replies = data.data.replies || [];
          repliesCursor = data.data.cursor;
          hasMoreReplies = data.data.hasMore;

          if (replies.length > 0) {
            const html = replies.map(renderReplyCard).join('');
            
            if (append) {
              const loadMoreBtn = document.getElementById('load-more-replies');
              if (loadMoreBtn) loadMoreBtn.remove();
              repliesContainer.insertAdjacentHTML('beforeend', html);
            } else {
              repliesContainer.innerHTML = html;
            }

            if (hasMoreReplies) {
              repliesContainer.insertAdjacentHTML('beforeend', 
                '<div class="load-more-section">' +
                  '<button id="load-more-replies" class="load-more-btn">Load more replies</button>' +
                '</div>'
              );
              document.getElementById('load-more-replies').addEventListener('click', function() {
                this.textContent = 'Loading...';
                this.disabled = true;
                loadReplies(true);
              });
            }

            attachReplyActionHandlers();
          } else if (!append) {
            repliesContainer.innerHTML = '<div class="empty-state">No replies yet. Be the first to reply!</div>';
          }
        }
      } catch (error) {
        console.error('Error loading replies:', error);
        if (!append) {
          document.getElementById('replies-container').innerHTML = '<div class="error">Error loading replies</div>';
        }
      } finally {
        isLoadingReplies = false;
      }
    }

    async function handleLike() {
      const likeBtn = document.getElementById('like-btn');
      const likeCount = document.getElementById('like-count');
      const isLiked = likeBtn.classList.contains('liked');

      try {
        if (isLiked) {
          await posts.unlike(postId);
          likeBtn.classList.remove('liked');
          likeCount.textContent = parseInt(likeCount.textContent) - 1;
        } else {
          await posts.like(postId);
          likeBtn.classList.add('liked');
          likeCount.textContent = parseInt(likeCount.textContent) + 1;
        }
      } catch (error) {
        console.error('Error liking post:', error);
      }
    }

    async function handleRepost() {
      const repostBtn = document.getElementById('repost-btn');
      const repostCount = document.getElementById('repost-count');

      // Don't allow reposting if already reposted
      if (repostBtn.classList.contains('reposted')) {
        return;
      }

      try {
        const response = await posts.repost(postId);
        if (response.success) {
          repostBtn.classList.add('reposted');
          repostCount.textContent = parseInt(repostCount.textContent) + 1;
        }
      } catch (error) {
        console.error('Error reposting:', error);
        alert(error.message || 'Could not repost');
      }
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
          '<div class="link-card-body">' +
            '<div class="link-card-domain"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' + escapeHtml(domain) + '</div>' +
            (data.title ? '<div class="link-card-title">' + escapeHtml(data.title) + '</div>' : '') +
            (data.description ? '<div class="link-card-description">' + escapeHtml(data.description) + '</div>' : '') +
          '</div>' +
        '</a>';
      } else {
        return '<a href="' + escapeHtml(url) + '" class="link-card" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">' +
          '<div class="link-card-body">' +
            '<div class="link-card-domain"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' + escapeHtml(domain) + '</div>' +
            (data.title ? '<div class="link-card-title">' + escapeHtml(data.title) + '</div>' : '') +
            (data.description ? '<div class="link-card-description">' + escapeHtml(data.description) + '</div>' : '') +
          '</div>' +
        '</a>';
      }
    }

    async function loadLinkCards() {
      document.querySelectorAll('.link-card-container').forEach(async (container) => {
        const url = container.dataset.url;
        if (!url) return;

        const videoId = getYouTubeId(url);
        if (videoId) {
          container.innerHTML = renderYouTubeEmbed(videoId);
          return;
        }

        try {
          const response = await fetch('/api/unfurl?url=' + encodeURIComponent(url));
          if (!response.ok) {
            container.remove();
            return;
          }
          const result = await response.json();
          if (result.success && result.data) {
            container.innerHTML = renderLinkCard(result.data, url);
          } else {
            container.remove();
          }
        } catch (error) {
          console.error('Error loading link card:', error);
          container.remove();
        }
      });
    }

    // Attach reply action handlers for like/repost on replies
    function attachReplyActionHandlers() {
      document.querySelectorAll('[data-action="like"]').forEach(btn => {
        btn.addEventListener('click', async function(e) {
          e.stopPropagation();
          const postId = this.dataset.postId;
          const isLiked = this.classList.contains('liked');
          const countEl = this.querySelector('.like-count');

          try {
            if (isLiked) {
              await posts.unlike(postId);
              this.classList.remove('liked');
              if (countEl) countEl.textContent = parseInt(countEl.textContent) - 1;
            } else {
              await posts.like(postId);
              this.classList.add('liked');
              if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
            }
          } catch (error) {
            console.error('Error liking:', error);
          }
        });
      });

      document.querySelectorAll('[data-action="repost"]').forEach(btn => {
        btn.addEventListener('click', async function(e) {
          e.stopPropagation();
          if (this.classList.contains('reposted')) return;

          const postId = this.dataset.postId;
          const countEl = this.querySelector('.repost-count');

          try {
            const response = await posts.repost(postId);
            if (response.success) {
              this.classList.add('reposted');
              if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
            }
          } catch (error) {
            console.error('Error reposting:', error);
            alert(error.message || 'Could not repost');
          }
        });
      });
    }

    loadPost().then(() => {
      loadLinkCards();
      attachReplyActionHandlers();
    });
    loadUserProfile();
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
