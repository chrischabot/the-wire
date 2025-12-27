/**
 * Shared Post Rendering Components
 *
 * This module provides reusable JavaScript code for rendering posts consistently
 * across all pages (home, explore, search, profile, post detail).
 */

/**
 * Configuration options for post rendering
 */
export interface PostRenderConfig {
  /** Show the dropdown menu (...) with follow/block/delete options */
  showDropdownMenu?: boolean;
  /** Show interactive action buttons (like, repost, reply) */
  showInteractiveActions?: boolean;
  /** Enable link card unfurling */
  enableLinkCards?: boolean;
  /** Enable YouTube embed detection */
  enableYouTubeEmbeds?: boolean;
  /** Show repost indicator for pure reposts */
  showRepostIndicator?: boolean;
  /** Container ID for the posts */
  containerId: string;
  /** Current user handle (for ownership checks) */
  currentUserHandle?: string;
  /** Current user ID (for ownership checks) */
  currentUserId?: string;
}

/**
 * Generates the shared utility functions JavaScript code
 */
export function getSharedUtilsScript(): string {
  return `
    // =====================================================
    // SHARED UTILITY FUNCTIONS
    // =====================================================

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatTimeAgo(date) {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'now';
      if (diffMins < 60) return diffMins + 'm';
      if (diffHours < 24) return diffHours + 'h';
      if (diffDays < 7) return diffDays + 'd';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      const match = text.match(/https?:\\/\\/[^\\s]+/);
      return match ? match[0] : null;
    }

    function getYouTubeId(url) {
      if (!url) return null;
      const match = url.match(/(?:youtube\\.com\\/(?:watch\\?v=|embed\\/)|youtu\\.be\\/)([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }

    function renderYouTubeEmbed(videoId) {
      return '<div class="youtube-embed">' +
        '<iframe src="https://www.youtube.com/embed/' + videoId + '" ' +
        'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
        'allowfullscreen></iframe></div>';
    }

    function renderLinkCard(data, url) {
      const hostname = new URL(url).hostname;
      let html = '<a href="' + escapeHtml(url) + '" class="link-card" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">';
      if (data.image) {
        html += '<img src="' + escapeHtml(data.image) + '" class="link-card-image" alt="">';
      }
      html += '<div class="link-card-content">';
      html += '<div class="link-card-title">' + escapeHtml(data.title || url) + '</div>';
      if (data.description) {
        html += '<div class="link-card-description">' + escapeHtml(data.description) + '</div>';
      }
      html += '<div class="link-card-domain">' + escapeHtml(hostname) + '</div>';
      html += '</div></a>';
      return html;
    }

    async function loadLinkCards() {
      const containers = document.querySelectorAll('.link-card-container[data-url]');
      for (const container of containers) {
        const url = container.getAttribute('data-url');
        if (!url || container.querySelector('.link-card, .youtube-embed')) continue;

        const youtubeId = getYouTubeId(url);
        if (youtubeId) {
          container.innerHTML = renderYouTubeEmbed(youtubeId);
          continue;
        }

        try {
          const response = await fetch('/api/unfurl?url=' + encodeURIComponent(url));
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              container.innerHTML = renderLinkCard(result.data, url);
            }
          }
        } catch (e) {
          console.error('Error loading link card:', e);
        }
      }
    }
  `;
}

/**
 * Generates the dropdown menu management JavaScript code
 */
export function getDropdownMenuScript(): string {
  return `
    // =====================================================
    // DROPDOWN MENU MANAGEMENT
    // =====================================================

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

      if (openDropdown === postId) {
        closeAllDropdowns();
        return;
      }

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

      // If it's not own post, check following state
      if (!isOwnPost) {
        const followBtn = document.getElementById('follow-btn-' + postId);
        if (followBtn) {
          const textSpan = followBtn.querySelector('.follow-text');
          if (followingState[authorHandle] === undefined) {
            textSpan.textContent = 'Loading...';
            try {
              const response = await fetch('/api/users/' + authorHandle, {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
              });
              const data = await response.json();
              followingState[authorHandle] = data.data?.isFollowing || false;
            } catch (e) {
              followingState[authorHandle] = false;
            }
          }
          updateFollowButton(postId, authorHandle, followingState[authorHandle]);
        }
      }
    }

    function updateFollowButton(postId, handle, isFollowing) {
      const followBtn = document.getElementById('follow-btn-' + postId);
      if (followBtn) {
        const textSpan = followBtn.querySelector('.follow-text');
        textSpan.textContent = isFollowing ? 'Unfollow @' + handle : 'Follow @' + handle;
        followBtn.classList.toggle('following', isFollowing);
      }
    }

    async function toggleFollow(handle, postId) {
      const followBtn = document.getElementById('follow-btn-' + postId);
      const textSpan = followBtn?.querySelector('.follow-text');
      const isCurrentlyFollowing = followingState[handle] || false;

      textSpan.textContent = isCurrentlyFollowing ? 'Unfollowing...' : 'Following...';

      try {
        const response = await fetch('/api/users/' + handle + '/follow', {
          method: isCurrentlyFollowing ? 'DELETE' : 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        if (response.ok) {
          followingState[handle] = !isCurrentlyFollowing;
          updateFollowButton(postId, handle, followingState[handle]);
        }
      } catch (e) {
        updateFollowButton(postId, handle, isCurrentlyFollowing);
      }
      closeAllDropdowns();
    }

    async function blockUser(handle) {
      if (!confirm('Block @' + handle + '? They won\\'t be able to see your posts or follow you.')) return;

      try {
        const response = await fetch('/api/users/' + handle + '/block', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        if (response.ok) {
          alert('Blocked @' + handle);
          window.location.reload();
        }
      } catch (e) {
        alert('Failed to block user');
      }
      closeAllDropdowns();
    }

    async function deletePost(postId) {
      if (!confirm('Delete this post? This cannot be undone.')) return;

      try {
        const response = await fetch('/api/posts/' + postId, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        if (response.ok) {
          const postCard = document.querySelector('[data-post-id="' + postId + '"]');
          if (postCard) {
            postCard.remove();
          }
        }
      } catch (e) {
        alert('Failed to delete post');
      }
      closeAllDropdowns();
    }

    async function removeRepost(postId) {
      if (!confirm('Remove this repost?')) return;

      try {
        const response = await fetch('/api/posts/' + postId, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        if (response.ok) {
          const postCard = document.querySelector('[data-post-id="' + postId + '"]');
          const repostIndicator = postCard?.previousElementSibling;
          if (repostIndicator && repostIndicator.classList.contains('repost-indicator')) {
            repostIndicator.remove();
          }
          if (postCard) {
            postCard.remove();
          }
        }
      } catch (e) {
        alert('Failed to remove repost');
      }
      closeAllDropdowns();
    }
  `;
}

/**
 * Generates the post card rendering JavaScript code
 */
export function getPostCardRendererScript(config: PostRenderConfig): string {
  const {
    showDropdownMenu = true,
    showInteractiveActions = true,
    enableLinkCards = true,
    showRepostIndicator = true,
    currentUserHandle = "",
    currentUserId = "",
  } = config;

  return `
    // =====================================================
    // POST CARD RENDERER
    // =====================================================

    const postConfig = {
      showDropdownMenu: ${showDropdownMenu},
      showInteractiveActions: ${showInteractiveActions},
      enableLinkCards: ${enableLinkCards},
      showRepostIndicator: ${showRepostIndicator},
      currentUserHandle: '${currentUserHandle}',
      currentUserId: '${currentUserId}'
    };

    function renderQuotedPost(originalPost) {
      if (!originalPost) return '';

      const mediaHtml = originalPost.mediaUrls && originalPost.mediaUrls.length > 0
        ? '<div class="quoted-post-media">' + originalPost.mediaUrls.map(function(url) {
            if (url.match(/\\.(mp4|webm|mov)$/i)) {
              return '<video src="' + url + '" controls></video>';
            }
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

    function renderPostMenu(post, displayPost, isOwnPost, isOwnRepost) {
      if (!postConfig.showDropdownMenu) return '';

      const removeRepostBtn = isOwnRepost
        ? '<button class="post-dropdown-item" onclick="event.stopPropagation(); removeRepost(\\'' + post.id + '\\')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><line x1="4" y1="4" x2="20" y2="20"/></svg>' +
            'Remove repost' +
          '</button>'
        : '';

      return '<div class="post-menu-container">' +
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
            : '<button class="post-dropdown-item follow-btn" id="follow-btn-' + post.id + '" onclick="event.stopPropagation(); toggleFollow(\\'' + displayPost.authorHandle + '\\', \\'' + post.id + '\\')">' +
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
    }

    function renderPostMedia(post) {
      if (!post.mediaUrls || post.mediaUrls.length === 0) return '';

      return '<div class="post-media">' + post.mediaUrls.map(function(url) {
        if (url.match(/\\.(mp4|webm|mov)$/i)) {
          return '<video src="' + url + '" controls class="post-media-item"></video>';
        }
        return '<img src="' + url + '" class="post-media-item media-zoomable" data-fullsrc="' + url + '" data-zoomable="true" alt="Post media" role="button" tabindex="0" onclick="event.stopPropagation()">';
      }).join('') + '</div>';
    }

    function renderLinkCardContainer(post, isPureRepost) {
      if (!postConfig.enableLinkCards) return '';
      if (post.mediaUrls && post.mediaUrls.length > 0) return '';
      if (isPureRepost) return '';

      const firstUrl = extractFirstUrl(post.content);
      return firstUrl ? '<div class="link-card-container" data-url="' + escapeHtml(firstUrl) + '"></div>' : '';
    }

    function renderPostActions(post, displayPost, isPureRepost) {
      const likedClass = post.hasLiked ? ' liked' : '';
      const repostedClass = post.hasReposted ? ' reposted' : '';
      const actionPostId = isPureRepost ? displayPost.id : post.id;

      const displayReplyCount = isPureRepost && displayPost.replyCount !== undefined ? displayPost.replyCount : post.replyCount;
      const displayRepostCount = isPureRepost && displayPost.repostCount !== undefined ? displayPost.repostCount : post.repostCount;
      const displayLikeCount = isPureRepost && displayPost.likeCount !== undefined ? displayPost.likeCount : post.likeCount;

      const interactiveAttr = postConfig.showInteractiveActions ? 'data-action' : 'data-display';

      return '<div class="post-actions" onclick="event.stopPropagation()">' +
        '<span class="post-action" ' + interactiveAttr + '="reply" data-post-id="' + actionPostId + '">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
          ' <span class="reply-count">' + (displayReplyCount || 0) + '</span>' +
        '</span>' +
        '<span class="post-action' + repostedClass + '" ' + interactiveAttr + '="repost" data-post-id="' + actionPostId + '">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
          ' <span class="repost-count">' + (displayRepostCount || 0) + '</span>' +
        '</span>' +
        '<span class="post-action' + likedClass + '" ' + interactiveAttr + '="like" data-post-id="' + actionPostId + '">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
          ' <span class="like-count">' + (displayLikeCount || 0) + '</span>' +
        '</span>' +
        '<span class="post-action">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>' +
        '</span>' +
      '</div>';
    }

    function renderPostCard(post) {
      const date = new Date(post.createdAt);
      const timeStr = formatTimeAgo(date);

      // Check if this is a pure repost (no added content)
      const isRepost = !!post.repostOfId;
      const isPureRepost = isRepost && !post.content && post.originalPost;

      // For pure reposts, show original post's author info
      const displayPost = isPureRepost ? post.originalPost : post;
      const displayDate = new Date(displayPost.createdAt);
      const displayTimeStr = formatTimeAgo(displayDate);

      const displayAvatarHtml = displayPost.authorAvatarUrl
        ? '<img src="' + displayPost.authorAvatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + displayPost.authorAvatarUrl + '" data-zoomable="true" alt="' + escapeHtml(displayPost.authorDisplayName) + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="avatar" style="background: #1D9BF0;"></div>';

      // Check ownership
      const currentHandle = postConfig.currentUserHandle.toLowerCase();
      const isOwnPost = currentHandle && displayPost.authorHandle && currentHandle === displayPost.authorHandle.toLowerCase();
      const isOwnRepost = isPureRepost && currentHandle && post.authorHandle && currentHandle === post.authorHandle.toLowerCase();

      // Repost indicator
      const repostIndicator = (postConfig.showRepostIndicator && isPureRepost)
        ? '<div class="repost-indicator"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ' + escapeHtml(post.authorDisplayName) + ' reposted</div>'
        : '';

      // Quoted post (for quote posts, not pure reposts)
      const quotedPostHtml = (post.originalPost && !isPureRepost) ? renderQuotedPost(post.originalPost) : '';

      // Menu HTML
      const postMenuHtml = renderPostMenu(post, displayPost, isOwnPost, isOwnRepost);

      // Navigate to the right post on click
      const clickPostId = isPureRepost ? displayPost.id : post.id;

      return repostIndicator + '<div class="post-card" data-post-id="' + post.id + '" onclick="window.location.href=\\'/post/' + clickPostId + '\\'">' +
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
            renderPostMedia(displayPost) +
            renderLinkCardContainer(displayPost, isPureRepost) +
            quotedPostHtml +
            renderPostActions(post, displayPost, isPureRepost) +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function renderPosts(posts, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="empty-state">No posts yet.</div>';
        return;
      }

      container.innerHTML = posts.map(renderPostCard).join('');

      // Attach action handlers if interactive
      if (postConfig.showInteractiveActions) {
        attachPostActionHandlers();
      }

      // Load link cards
      if (postConfig.enableLinkCards) {
        loadLinkCards();
      }
    }

    function appendPosts(posts, containerId) {
      const container = document.getElementById(containerId);
      if (!container || !posts || posts.length === 0) return;

      const html = posts.map(renderPostCard).join('');
      container.insertAdjacentHTML('beforeend', html);

      if (postConfig.showInteractiveActions) {
        attachPostActionHandlers();
      }

      if (postConfig.enableLinkCards) {
        loadLinkCards();
      }
    }
  `;
}

/**
 * Generates the post action handlers JavaScript code (like, repost)
 */
export function getPostActionHandlersScript(): string {
  return `
    // =====================================================
    // POST ACTION HANDLERS (Like, Repost)
    // =====================================================

    function attachPostActionHandlers() {
      document.querySelectorAll('[data-action="like"]').forEach(btn => {
        if (!btn.hasAttribute('data-handler-attached')) {
          btn.setAttribute('data-handler-attached', 'true');
          btn.addEventListener('click', handleLike);
        }
      });
      document.querySelectorAll('[data-action="repost"]').forEach(btn => {
        if (!btn.hasAttribute('data-handler-attached')) {
          btn.setAttribute('data-handler-attached', 'true');
          btn.addEventListener('click', handleRepost);
        }
      });
      document.querySelectorAll('[data-action="reply"]').forEach(btn => {
        if (!btn.hasAttribute('data-handler-attached')) {
          btn.setAttribute('data-handler-attached', 'true');
          btn.addEventListener('click', handleReply);
        }
      });
    }

    function handleReply(e) {
      e.stopPropagation();
      const btn = e.currentTarget;
      const postId = btn.dataset.postId;
      if (postId) {
        window.location.href = '/post/' + postId + '?reply=true';
      }
    }

    async function handleLike(e) {
      e.stopPropagation();
      const btn = e.currentTarget;
      const postId = btn.dataset.postId;
      const isLiked = btn.classList.contains('liked');
      const countSpan = btn.querySelector('.like-count');
      const currentCount = parseInt(countSpan.textContent) || 0;

      btn.classList.toggle('liked');
      countSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;

      try {
        const response = await fetch('/api/posts/' + postId + '/like', {
          method: isLiked ? 'DELETE' : 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        if (!response.ok) {
          btn.classList.toggle('liked');
          countSpan.textContent = currentCount;
        }
      } catch (e) {
        btn.classList.toggle('liked');
        countSpan.textContent = currentCount;
      }
    }

    async function handleRepost(e) {
      e.stopPropagation();
      const btn = e.currentTarget;
      const postId = btn.dataset.postId;
      const isReposted = btn.classList.contains('reposted');
      const countSpan = btn.querySelector('.repost-count');
      const currentCount = parseInt(countSpan.textContent) || 0;

      if (isReposted) {
        alert('You have already reposted this');
        return;
      }

      btn.classList.add('reposted');
      countSpan.textContent = currentCount + 1;

      try {
        const response = await fetch('/api/posts/' + postId + '/repost', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        if (!response.ok) {
          btn.classList.remove('reposted');
          countSpan.textContent = currentCount;
        }
      } catch (e) {
        btn.classList.remove('reposted');
        countSpan.textContent = currentCount;
      }
    }
  `;
}

/**
 * Generates a complete post rendering script with all features
 */
export function getCompletePostScript(config: PostRenderConfig): string {
  const parts = [getSharedUtilsScript()];

  if (config.showDropdownMenu) {
    parts.push(getDropdownMenuScript());
  }

  parts.push(getPostCardRendererScript(config));

  if (config.showInteractiveActions) {
    parts.push(getPostActionHandlersScript());
  }

  return parts.join("\n");
}
