import { getSidebarHtml } from "../shared/sidebar-renderer";
import { getBottomNavHtml } from "../shared/bottom-nav";

export function getHomePage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home / The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="twitter-layout">
    ${getSidebarHtml({ activePage: "home" })}

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <h2>Home</h2>
      </div>

      <div class="compose-box">
        <div style="display: flex; gap: 12px;">
          <img id="compose-avatar" class="avatar media-zoomable" src="" alt="Your avatar" style="display: none;" data-zoomable="true" role="button" tabindex="0">
          <div style="flex: 1;">
            <form id="compose-form">
              <textarea 
                id="note-content" 
                placeholder="What's happening?"
                maxlength="280"
              ></textarea>
              <div id="media-preview" class="media-preview" style="display: none;">
                <div id="media-preview-content"></div>
                <button type="button" id="remove-media" class="remove-media">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <div class="compose-footer">
                <div class="compose-actions">
                  <input type="file" id="image-upload" accept="image/*" style="display: none;">
                  <button type="button" class="icon-button" id="image-btn" title="Add image">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  </button>
                  <input type="file" id="video-upload" accept="video/*" style="display: none;">
                  <button type="button" class="icon-button" id="video-btn" title="Add video">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
                  </button>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span id="char-counter" class="char-counter">0 / 280</span>
                  <button type="submit" class="tweet-button" id="post-btn" disabled>Post</button>
                </div>
              </div>
            </form>
          </div>
        </div>
        <div id="compose-error" class="error"></div>
        <div id="compose-success" class="success"></div>
      </div>

      <div id="timeline">
        <div class="empty-state">Loading your timeline...</div>
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

    const textarea = document.getElementById('note-content');
    const charCounter = document.getElementById('char-counter');
    const postBtn = document.getElementById('post-btn');
    const composeForm = document.getElementById('compose-form');
    const composeError = document.getElementById('compose-error');
    const composeSuccess = document.getElementById('compose-success');
    const timeline = document.getElementById('timeline');

    let currentUser = null;
    let feedCursor = null;
    let isLoadingMore = false;
    let hasMorePosts = true;

    async function loadTimeline() {
      try {
        timeline.innerHTML = '<div class="empty-state">Loading your timeline...</div>';
        feedCursor = null;
        hasMorePosts = true;

        const response = await fetch('/api/feed/home?limit=20', {
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token'),
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load feed');
        }

        const feedData = await response.json();
        if (feedData.success && feedData.data.posts) {
          renderTimeline(feedData.data.posts);
          feedCursor = feedData.data.cursor;
          hasMorePosts = feedData.data.hasMore !== false;
        } else {
          timeline.innerHTML = '<div class="empty-state">No posts in your feed yet. Follow some users!</div>';
        }
      } catch (error) {
        console.error('Error loading timeline:', error);
        timeline.innerHTML = '<div class="error">Error loading timeline. Please refresh.</div>';
      }
    }

    async function loadMorePosts() {
      if (isLoadingMore || !hasMorePosts || !feedCursor) return;

      isLoadingMore = true;

      // Show loading indicator
      const loadingEl = document.createElement('div');
      loadingEl.className = 'loading-more';
      loadingEl.innerHTML = '<div class="spinner"></div>';
      timeline.appendChild(loadingEl);

      try {
        const response = await fetch('/api/feed/home?limit=20&cursor=' + encodeURIComponent(feedCursor), {
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token'),
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load more posts');
        }

        const feedData = await response.json();
        loadingEl.remove();

        if (feedData.success && feedData.data.posts && feedData.data.posts.length > 0) {
          appendPosts(feedData.data.posts);
          feedCursor = feedData.data.cursor;
          hasMorePosts = feedData.data.hasMore !== false;
        } else {
          hasMorePosts = false;
        }
      } catch (error) {
        console.error('Error loading more posts:', error);
        loadingEl.remove();
      } finally {
        isLoadingMore = false;
      }
    }

    // Infinite scroll handler
    function handleScroll() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // Load more when within 300px of bottom
      if (scrollTop + windowHeight >= docHeight - 300) {
        loadMorePosts();
      }
    }

    window.addEventListener('scroll', handleScroll);

    async function loadUserProfile() {
      try {
        const response = await auth.me();
        if (response.success) {
          const handle = response.data.handle;
          const profileResp = await users.getProfile(handle);
          if (profileResp.success) {
            currentUser = profileResp.data;
            
            const composeAvatar = document.getElementById('compose-avatar');
            if (currentUser.avatarUrl) {
              composeAvatar.src = currentUser.avatarUrl;
              composeAvatar.style.display = 'block';
              composeAvatar.setAttribute('data-fullsrc', currentUser.avatarUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    }

    textarea.addEventListener('input', () => {
      const length = textarea.value.length;
      charCounter.textContent = length + ' / 280';

      if (length === 0 && !selectedMedia) {
        postBtn.disabled = true;
      } else if (length > 260) {
        charCounter.className = 'char-counter warning';
        postBtn.disabled = false;
      } else {
        charCounter.className = 'char-counter';
        postBtn.disabled = false;
      }
    });

    composeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const content = textarea.value.trim();
      if (!content && !selectedMedia) return;

      composeError.textContent = '';
      composeSuccess.textContent = '';
      postBtn.disabled = true;
      postBtn.textContent = 'Posting...';

      try {
        let mediaUrls = [];

        // Upload media if selected
        if (selectedMedia) {
          postBtn.textContent = 'Uploading...';
          const mediaUrl = await uploadMedia(selectedMedia.file);
          mediaUrls = [mediaUrl];
        }

        const response = await posts.create(content, mediaUrls);

        if (response.success) {
          composeSuccess.textContent = 'Posted!';
          textarea.value = '';
          charCounter.textContent = '0 / 280';
          charCounter.className = 'char-counter';
          selectedMedia = null;
          mediaPreview.style.display = 'none';
          mediaPreviewContent.innerHTML = '';
          imageUpload.value = '';
          videoUpload.value = '';

          setTimeout(() => {
            loadTimeline();
            composeSuccess.textContent = '';
          }, 1000);
        }
      } catch (error) {
        composeError.textContent = error.message;
      } finally {
        postBtn.disabled = false;
        postBtn.textContent = 'Post';
      }
    });

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

    function renderTimeline(posts) {
      if (!posts || posts.length === 0) {
        timeline.innerHTML = '<div class="empty-state">No posts yet. Create a post or follow users to see content!</div>';
        return;
      }

      timeline.innerHTML = posts.map(post => {
        const date = new Date(post.createdAt);
        const timeStr = formatTimeAgo(date);

        const avatarHtml = post.authorAvatarUrl
          ? '<img src="' + post.authorAvatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + post.authorAvatarUrl + '" data-zoomable="true" alt="' + post.authorDisplayName + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
          : '<div class="avatar" style="background: #1D9BF0;"></div>';

        const likedClass = post.hasLiked ? ' liked' : '';
        const repostedClass = post.hasReposted ? ' reposted' : '';

        // Check if this is a pure repost (no added content)
        const isRepost = !!post.repostOfId;
        const isPureRepost = isRepost && !post.content && post.originalPost;

        // For pure reposts, show original post's author info
        const displayPost = isPureRepost ? post.originalPost : post;
        const displayAvatarHtml = displayPost.authorAvatarUrl
          ? '<img src="' + displayPost.authorAvatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + displayPost.authorAvatarUrl + '" data-zoomable="true" alt="' + displayPost.authorDisplayName + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
          : '<div class="avatar" style="background: #1D9BF0;"></div>';
        const displayDate = new Date(displayPost.createdAt);
        const displayTimeStr = formatTimeAgo(displayDate);

        const repostIndicator = isPureRepost
          ? '<div class="repost-indicator"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ' + escapeHtml(post.authorDisplayName) + ' reposted</div>'
          : '';

        // For quote posts, show quoted content; for pure reposts, don't show it again
        const quotedPostHtml = (post.originalPost && !isPureRepost) ? renderQuotedPost(post.originalPost) : '';

        // For pure reposts, use original post's counts; otherwise use the post's own counts
        const displayReplyCount = isPureRepost && displayPost.replyCount !== undefined ? displayPost.replyCount : post.replyCount;
        const displayRepostCount = isPureRepost && displayPost.repostCount !== undefined ? displayPost.repostCount : post.repostCount;
        const displayLikeCount = isPureRepost && displayPost.likeCount !== undefined ? displayPost.likeCount : post.likeCount;
        // For reposts, use the original post's ID for like/repost actions
        const actionPostId = isPureRepost ? displayPost.id : post.id;

        const isOwnPost = currentUser && currentUser.handle && currentUser.handle.toLowerCase() === displayPost.authorHandle.toLowerCase();
        // Check if this is user's own repost (they reposted someone else's post)
        const isOwnRepost = isPureRepost && currentUser && currentUser.handle && currentUser.handle.toLowerCase() === post.authorHandle.toLowerCase();

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
              (displayPost.mediaUrls && displayPost.mediaUrls.length > 0 ? '<div class="post-media">' + displayPost.mediaUrls.map(function(url) {
                if (url.match(/\\.(mp4|webm|mov)$/i)) {
                  return '<video src="' + url + '" controls class="post-media-item"></video>';
                }
                return '<img src="' + url + '" class="post-media-item media-zoomable" data-fullsrc="' + url + '" data-zoomable="true" alt="Post media" role="button" tabindex="0" onclick="event.stopPropagation()">';
              }).join('') + '</div>' : '') +
              (function() {
                var firstUrl = (!displayPost.mediaUrls || displayPost.mediaUrls.length === 0) && !isPureRepost ? extractFirstUrl(displayPost.content) : null;
                return firstUrl ? '<div class="link-card-container" data-url="' + escapeHtml(firstUrl) + '"></div>' : '';
              })() +
              quotedPostHtml +
              '<div class="post-actions" onclick="event.stopPropagation()">' +
                '<span class="post-action">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                  ' ' + displayReplyCount +
                '</span>' +
                '<span class="post-action' + repostedClass + '" data-action="repost" data-post-id="' + actionPostId + '">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
                  ' <span class="repost-count">' + displayRepostCount + '</span>' +
                '</span>' +
                '<span class="post-action' + likedClass + '" data-action="like" data-post-id="' + actionPostId + '">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
                  ' <span class="like-count">' + displayLikeCount + '</span>' +
                '</span>' +
                '<span class="post-action">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>' +
                '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      document.querySelectorAll('[data-action="like"]').forEach(btn => {
        btn.addEventListener('click', handleLike);
      });
      document.querySelectorAll('[data-action="repost"]').forEach(btn => {
        btn.addEventListener('click', handleRepost);
      });

      // Load link cards for URLs in posts
      loadLinkCards();
    }

    function appendPosts(posts) {
      if (!posts || posts.length === 0) return;

      const postsHtml = posts.map(post => {
        const date = new Date(post.createdAt);
        const timeStr = formatTimeAgo(date);

        const avatarHtml = post.authorAvatarUrl
          ? '<img src="' + post.authorAvatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + post.authorAvatarUrl + '" data-zoomable="true" alt="' + post.authorDisplayName + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
          : '<div class="avatar" style="background: #1D9BF0;"></div>';

        const likedClass = post.hasLiked ? ' liked' : '';
        const repostedClass = post.hasReposted ? ' reposted' : '';

        const isRepost = !!post.repostOfId;
        const isPureRepost = isRepost && !post.content && post.originalPost;
        const displayPost = isPureRepost ? post.originalPost : post;
        const displayAvatarHtml = displayPost.authorAvatarUrl
          ? '<img src="' + displayPost.authorAvatarUrl + '" class="avatar media-zoomable" data-fullsrc="' + displayPost.authorAvatarUrl + '" data-zoomable="true" alt="' + displayPost.authorDisplayName + '" role="button" tabindex="0" onclick="event.stopPropagation()">'
          : '<div class="avatar" style="background: #1D9BF0;"></div>';
        const displayDate = new Date(displayPost.createdAt);
        const displayTimeStr = formatTimeAgo(displayDate);

        const repostIndicator = isPureRepost
          ? '<div class="repost-indicator"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ' + escapeHtml(post.authorDisplayName) + ' reposted</div>'
          : '';

        const quotedPostHtml = (post.originalPost && !isPureRepost) ? renderQuotedPost(post.originalPost) : '';

        const displayReplyCount = isPureRepost && displayPost.replyCount !== undefined ? displayPost.replyCount : post.replyCount;
        const displayRepostCount = isPureRepost && displayPost.repostCount !== undefined ? displayPost.repostCount : post.repostCount;
        const displayLikeCount = isPureRepost && displayPost.likeCount !== undefined ? displayPost.likeCount : post.likeCount;
        const actionPostId = isPureRepost ? displayPost.id : post.id;

        const isOwnPost = currentUser && currentUser.handle && currentUser.handle.toLowerCase() === displayPost.authorHandle.toLowerCase();
        const isOwnRepost = isPureRepost && currentUser && currentUser.handle && currentUser.handle.toLowerCase() === post.authorHandle.toLowerCase();

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
              (displayPost.mediaUrls && displayPost.mediaUrls.length > 0 ? '<div class="post-media">' + displayPost.mediaUrls.map(function(url) {
                if (url.match(/\\.(mp4|webm|mov)$/i)) {
                  return '<video src="' + url + '" controls class="post-media-item"></video>';
                }
                return '<img src="' + url + '" class="post-media-item media-zoomable" data-fullsrc="' + url + '" data-zoomable="true" alt="Post media" role="button" tabindex="0" onclick="event.stopPropagation()">';
              }).join('') + '</div>' : '') +
              (function() {
                var firstUrl = (!displayPost.mediaUrls || displayPost.mediaUrls.length === 0) && !isPureRepost ? extractFirstUrl(displayPost.content) : null;
                return firstUrl ? '<div class="link-card-container" data-url="' + escapeHtml(firstUrl) + '"></div>' : '';
              })() +
              quotedPostHtml +
              '<div class="post-actions" onclick="event.stopPropagation()">' +
                '<span class="post-action">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                  ' ' + displayReplyCount +
                '</span>' +
                '<span class="post-action' + repostedClass + '" data-action="repost" data-post-id="' + actionPostId + '">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
                  ' <span class="repost-count">' + displayRepostCount + '</span>' +
                '</span>' +
                '<span class="post-action' + likedClass + '" data-action="like" data-post-id="' + actionPostId + '">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
                  ' <span class="like-count">' + displayLikeCount + '</span>' +
                '</span>' +
                '<span class="post-action">' +
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>' +
                '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      // Create temp container for new posts
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = postsHtml;

      // Append each post
      while (tempDiv.firstChild) {
        timeline.appendChild(tempDiv.firstChild);
      }

      // Add event listeners for new posts
      document.querySelectorAll('[data-action="like"]:not([data-bound])').forEach(btn => {
        btn.addEventListener('click', handleLike);
        btn.dataset.bound = 'true';
      });
      document.querySelectorAll('[data-action="repost"]:not([data-bound])').forEach(btn => {
        btn.addEventListener('click', handleRepost);
        btn.dataset.bound = 'true';
      });

      // Load link cards for new posts
      loadLinkCards();
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
      } else if (data.image) {
        return '<a href="' + escapeHtml(url) + '" class="link-card link-card-small" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">' +
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
      var cardContainers = document.querySelectorAll('.link-card-container[data-url]');
      for (var container of cardContainers) {
        var url = container.dataset.url;
        if (!url || container.dataset.loaded === 'true') continue;
        container.dataset.loaded = 'true';

        var youtubeId = getYouTubeId(url);
        if (youtubeId) {
          container.innerHTML = renderYouTubeEmbed(youtubeId);
          continue;
        }

        try {
          var response = await fetch('/api/unfurl?url=' + encodeURIComponent(url));
          var result = await response.json();
          if (result.success && result.data && (result.data.title || result.data.image)) {
            container.innerHTML = renderLinkCard(result.data, url);
          } else {
            container.remove();
          }
        } catch (error) {
          console.error('Error loading link card:', error);
          container.remove();
        }
      }
    }

    async function handleLike(e) {
      e.stopPropagation();
      const button = e.currentTarget;
      const postId = button.dataset.postId;
      const likeCountSpan = button.querySelector('.like-count');
      const isLiked = button.classList.contains('liked');

      try {
        if (isLiked) {
          await posts.unlike(postId);
          button.classList.remove('liked');
          likeCountSpan.textContent = parseInt(likeCountSpan.textContent) - 1;
        } else {
          await posts.like(postId);
          button.classList.add('liked');
          likeCountSpan.textContent = parseInt(likeCountSpan.textContent) + 1;
        }
      } catch (error) {
        console.error('Error liking post:', error);
      }
    }

    async function handleRepost(e) {
      e.stopPropagation();
      const button = e.currentTarget;
      const postId = button.dataset.postId;
      const repostCountSpan = button.querySelector('.repost-count');
      const isReposted = button.classList.contains('reposted');

      // Don't allow un-reposting (like Twitter/X)
      if (isReposted) {
        return;
      }

      try {
        await posts.repost(postId);
        button.classList.add('reposted');
        repostCountSpan.textContent = parseInt(repostCountSpan.textContent) + 1;
      } catch (error) {
        console.error('Error reposting:', error);
      }
    }

    // Dropdown menu functionality
    let openDropdown = null;
    const followingState = {};

    function closeAllDropdowns() {
      document.querySelectorAll('.post-dropdown.open').forEach(dropdown => {
        dropdown.classList.remove('open');
      });
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

      try {
        if (textSpan) textSpan.textContent = 'Loading...';
        const method = isCurrentlyFollowing ? 'DELETE' : 'POST';
        await fetch('/api/users/' + handle + '/follow', {
          method: method,
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        followingState[handle] = !isCurrentlyFollowing;
        updateFollowButton(postId, handle, followingState[handle]);
        closeAllDropdowns();
      } catch (error) {
        console.error('Error toggling follow:', error);
        alert('Failed to update follow status');
        updateFollowButton(postId, handle, isCurrentlyFollowing);
      }
    }

    async function blockUser(handle) {
      if (!confirm('Are you sure you want to block @' + handle + '? They won\\'t be able to see your posts or interact with you.')) {
        return;
      }

      try {
        await fetch('/api/users/' + handle + '/block', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        // Remove all posts from this user
        document.querySelectorAll('.post-card').forEach(card => {
          const dropdown = card.querySelector('.post-dropdown');
          if (dropdown && dropdown.dataset.author === handle) {
            card.remove();
          }
        });
        closeAllDropdowns();
      } catch (error) {
        console.error('Error blocking user:', error);
        alert('Failed to block user');
      }
    }

    async function deletePost(postId) {
      if (!confirm('Are you sure you want to delete this post?')) {
        return;
      }

      try {
        await fetch('/api/posts/' + postId, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        const postElement = document.querySelector('[data-post-id="' + postId + '"]');
        if (postElement) postElement.remove();
        closeAllDropdowns();
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post');
      }
    }

    async function removeRepost(postId) {
      if (!confirm('Remove this repost?')) {
        return;
      }

      try {
        await fetch('/api/posts/' + postId, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
        });
        const postElement = document.querySelector('[data-post-id="' + postId + '"]');
        if (postElement) {
          // Also remove the repost indicator if present
          const prev = postElement.previousElementSibling;
          if (prev && prev.classList.contains('repost-indicator')) {
            prev.remove();
          }
          postElement.remove();
        }
        closeAllDropdowns();
      } catch (error) {
        console.error('Error removing repost:', error);
        alert('Failed to remove repost');
      }
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllDropdowns();
    });

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

    // Media upload handling
    let selectedMedia = null;
    const imageUpload = document.getElementById('image-upload');
    const videoUpload = document.getElementById('video-upload');
    const imageBtn = document.getElementById('image-btn');
    const videoBtn = document.getElementById('video-btn');
    const mediaPreview = document.getElementById('media-preview');
    const mediaPreviewContent = document.getElementById('media-preview-content');
    const removeMediaBtn = document.getElementById('remove-media');

    imageBtn.addEventListener('click', () => imageUpload.click());
    videoBtn.addEventListener('click', () => videoUpload.click());

    imageUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedMedia = { file, type: 'image' };
        showMediaPreview(file, 'image');
      }
    });

    videoUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedMedia = { file, type: 'video' };
        showMediaPreview(file, 'video');
      }
    });

    function showMediaPreview(file, type) {
      const url = URL.createObjectURL(file);
      if (type === 'image') {
        mediaPreviewContent.innerHTML = '<img src="' + url + '" alt="Preview">';
      } else {
        mediaPreviewContent.innerHTML = '<video src="' + url + '" controls></video>';
      }
      mediaPreview.style.display = 'flex';
      postBtn.disabled = false;
    }

    removeMediaBtn.addEventListener('click', () => {
      selectedMedia = null;
      mediaPreview.style.display = 'none';
      mediaPreviewContent.innerHTML = '';
      imageUpload.value = '';
      videoUpload.value = '';
      if (textarea.value.length === 0) {
        postBtn.disabled = true;
      }
    });

    async function uploadMedia(file) {
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

    loadTimeline();
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
