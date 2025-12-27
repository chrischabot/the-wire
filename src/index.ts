/**
 * The Wire - Main Worker Entry Point
 * A globally distributed social network on Cloudflare edge
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import type { Env } from './types/env';
import authRoutes from './handlers/auth';
import usersRoutes from './handlers/users';
import postsRoutes from './handlers/posts';
import mediaRoutes from './handlers/media';
import feedRoutes from './handlers/feed';
import moderationRoutes from './handlers/moderation';
import adminRoutes from './handlers/admin';
import notificationsRoutes from './handlers/notifications';
import searchRoutes from './handlers/search';
import seedRoutes from './handlers/seed';
import unfurlRoutes from './handlers/unfurl';
import { rateLimit, RATE_LIMITS } from './middleware/rate-limit';
import { csrfProtection } from './middleware/csrf';
import { handleScheduled } from './handlers/scheduled';
import { getCompletePostScript } from './shared/post-renderer';
import { getSidebarHtml } from './shared/sidebar-renderer';

// Create Hono app with environment typing
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', cors());

// Request body size limit (1MB for JSON, handled separately for multipart)
app.use('/api/*', bodyLimit({
  maxSize: 1024 * 1024, // 1MB
  onError: (c) => {
    return c.json({
      success: false,
      error: 'Request body too large',
    }, 413);
  },
}));

// CSRF protection for state-changing requests
app.use('*', csrfProtection({
  allowedOrigins: [
    'http://localhost:8787',
    'http://localhost:8080',
    'http://127.0.0.1:8787',
    'http://127.0.0.1:8080',
    'https://the-wire.chabotc.workers.dev',
  ],
  exemptPaths: [
    '/api/auth/login',
    '/api/auth/signup',
    '/health',
    '/debug/reset', // For testing database reset
    '/debug/bootstrap-admin', // For bootstrapping first admin
  ]
}));

// General API rate limiting (100 req/min per IP)
app.use('/api/*', rateLimit({ ...RATE_LIMITS.api, perUser: false }));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'the-wire',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT,
    },
  });
});

// Landing page
app.get('/', (c) => {
  const landingPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Wire - Share Notes Globally</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    .hero {
      text-align: center;
      padding: 3rem 2rem 4rem;
      max-width: 800px;
      margin: 0 auto;
    }
    .brand-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 2rem;
    }
    .brand-logo .logo-circle {
      width: 80px;
      height: 80px;
      border: 3px solid var(--foreground);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }
    .brand-logo .logo-text {
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-size: 36px;
      font-weight: 900;
      color: var(--foreground);
      letter-spacing: -1px;
    }
    .brand-logo .logo-name {
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-size: 28px;
      font-weight: 700;
      color: var(--foreground);
      letter-spacing: 2px;
    }
    .tagline {
      font-size: 1.35rem;
      color: var(--muted-foreground);
      margin-bottom: 2rem;
    }
    .cta {
      display: inline-block;
      padding: 16px 32px;
      background: var(--primary);
      color: var(--primary-foreground);
      text-decoration: none;
      border-radius: var(--radius-lg);
      font-weight: 700;
      font-size: 17px;
      transition: var(--transition);
    }
    .cta:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }
    .features {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      max-width: 900px;
      margin: 3rem auto 0;
      padding: 0 2rem;
    }
    @media (min-width: 768px) {
      .features {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    .feature {
      padding: 1.5rem;
      background: var(--muted);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      text-align: center;
    }
    .feature svg {
      width: 48px;
      height: 48px;
      stroke: var(--primary);
      margin-bottom: 1rem;
    }
    .feature h3 {
      margin-bottom: 0.5rem;
      color: var(--foreground);
      font-weight: 700;
    }
    .feature p {
      font-size: 0.9rem;
      color: var(--muted-foreground);
    }
  </style>
</head>
<body>
  <div class="hero">
    <div class="brand-logo">
      <div class="logo-circle">
        <span class="logo-text">TW</span>
      </div>
      <span class="logo-name">The Wire</span>
    </div>
    <p class="tagline">Share your notes with the world. Lightning fast.</p>
    <a href="/signup" class="cta">Get Started</a>
    <div class="features">
      <div class="feature">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <h3>Edge-Native</h3>
        <p>Powered by Cloudflare's global network for sub-50ms latency</p>
      </div>
      <div class="feature">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        <h3>Notes</h3>
        <p>Share thoughts in 280 characters or less</p>
      </div>
      <div class="feature">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        <h3>Global</h3>
        <p>Distributed infrastructure across 300+ locations</p>
      </div>
    </div>
  </div>

  <script src="/js/api.js?v=9"></script>
</body>
</html>
  `;
  return c.html(landingPage);
});

// Signup page
app.get('/signup', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="auth-container">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 50px; height: 50px; border: 2px solid var(--foreground); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 700; color: var(--foreground); letter-spacing: -0.5px;">TW</div>
    </div>
    <h1 class="text-center" style="font-size: 31px; font-weight: 700; margin-bottom: 8px;">Join The Wire</h1>
    <p class="text-center text-muted" style="margin-bottom: 1rem;">
      Create your account today
    </p>

    <form id="signup-form" style="margin-top: 24px;">
      <div class="form-group">
        <label for="handle">Username</label>
        <input 
          type="text" 
          id="handle" 
          name="handle" 
          placeholder="username"
          required
          pattern="[a-zA-Z0-9_]{3,15}"
          minlength="3"
          maxlength="15"
        >
        <small>3-15 characters, letters, numbers, and underscores</small>
      </div>

      <div class="form-group">
        <label for="email">Email</label>
        <input 
          type="email" 
          id="email" 
          name="email" 
          placeholder="you@example.com"
          required
        >
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          placeholder="••••••••"
          required
          minlength="8"
        >
        <small>At least 8 characters</small>
      </div>

      <div id="error-message" class="error"></div>
      <div id="success-message" class="success"></div>

      <button type="submit" class="btn-primary" style="width: 100%; margin-top: 12px;" id="submit-btn">Create account</button>
    </form>

    <p class="text-center mt-1" style="margin-top: 40px;">
      Already have an account? 
      <a href="/login" class="link">Sign in</a>
    </p>
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    const form = document.getElementById('signup-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorMsg = document.getElementById('error-message');
    const successMsg = document.getElementById('success-message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      errorMsg.textContent = '';
      successMsg.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const handle = document.getElementById('handle').value;

      try {
        const response = await auth.signup(email, password, handle);
        
        if (response.success) {
          successMsg.textContent = 'Account created! Redirecting...';
          setTimeout(() => {
            window.location.href = '/home';
          }, 1000);
        }
      } catch (error) {
        errorMsg.textContent = error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create account';
      }
    });
  </script>
</body>
</html>
  `);
});

// Login page
app.get('/login', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log In - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="auth-container">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 50px; height: 50px; border: 2px solid var(--foreground); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 700; color: var(--foreground); letter-spacing: -0.5px;">TW</div>
    </div>
    <h1 class="text-center" style="font-size: 31px; font-weight: 700; margin-bottom: 8px;">Sign in to The Wire</h1>

    <form id="login-form" style="margin-top: 32px;">
      <div class="form-group">
        <label for="email">Email</label>
        <input 
          type="email" 
          id="email" 
          name="email" 
          placeholder="you@example.com"
          required
        >
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          placeholder="••••••••"
          required
        >
      </div>

      <div id="error-message" class="error"></div>
      <div id="success-message" class="success"></div>

      <button type="submit" class="btn-primary" style="width: 100%; margin-top: 12px;" id="submit-btn">Sign in</button>
    </form>

    <p class="text-center mt-1" style="margin-top: 40px;">
      Don't have an account? 
      <a href="/signup" class="link">Sign up</a>
    </p>
  </div>

  <script src="/js/api.js?v=9"></script>
  <script>
    const form = document.getElementById('login-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorMsg = document.getElementById('error-message');
    const successMsg = document.getElementById('success-message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      errorMsg.textContent = '';
      successMsg.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const response = await auth.login(email, password);
        
        if (response.success) {
          successMsg.textContent = 'Logged in! Redirecting...';
          setTimeout(() => {
            window.location.href = '/home';
          }, 1000);
        }
      } catch (error) {
        errorMsg.textContent = error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      }
    });
  </script>
</body>
</html>
  `);
});

// Home page
app.get('/home', (c) => {
  return c.html(`
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
    ${getSidebarHtml({ activePage: 'home' })}

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
          document.getElementById('profile-nav').href = '/u/' + response.data.handle;
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
</body>
</html>
  `);
});

// Search results page
app.get('/search', (c) => {
  return c.html(`
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
            document.getElementById('profile-nav').href = '/u/' + response.data.handle;
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
      containerId: 'search-results',
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
</body>
</html>
  `);
});

// Explore page
app.get('/explore', (c) => {
  return c.html(`
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
            document.getElementById('profile-nav').href = '/u/' + response.data.handle;
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
      containerId: 'explore-content',
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
</body>
</html>
  `);
});

// Notifications page
app.get('/notifications', (c) => {
  return c.html(`
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
          document.getElementById('profile-nav').href = '/u/' + response.data.handle;
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
</body>
</html>
  `);
});

// Single post view
app.get('/post/:id', (c) => {
  const postId = c.req.param('id');
  return c.html(`
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
            loadReplies();
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
          
          loadReplies();
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
          document.getElementById('profile-nav').href = '/u/' + response.data.handle;

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
              loadReplies();
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

    async function loadReplies() {
      try {
        const response = await fetch('/api/posts/' + postId + '/thread');
        const data = await response.json();
        
        const repliesContainer = document.getElementById('replies-container');
        
        if (data.success && data.data.replies && data.data.replies.length > 0) {
          repliesContainer.innerHTML = data.data.replies.map(reply => {
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
          }).join('');
          // Attach action handlers for the newly rendered replies
          attachReplyActionHandlers();
        } else {
          repliesContainer.innerHTML = '<div class="empty-state">No replies yet. Be the first to reply!</div>';
        }
      } catch (error) {
        console.error('Error loading replies:', error);
        document.getElementById('replies-container').innerHTML = '<div class="error">Error loading replies</div>';
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
</body>
</html>
  `);
});

// Settings page
app.get('/settings', (c) => {
  return c.html(`
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
          document.getElementById('profile-nav').href = '/u/' + response.data.handle;
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
</body>
</html>
  `);
});

app.get('/settings/muted', (c) => {
  return c.html(`
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
          document.getElementById('profile-nav').href = '/u/' + response.data.handle;
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
</body>
</html>
  `);
});

// Admin Dashboard
app.get('/admin', (c) => {
  return c.html(`
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
</body>
</html>
  `);
});

// Public profile page - MUST be before API routes to avoid conflicts
app.get('/u/:handle', (c) => {
  const handle = c.req.param('handle');
  return c.html(`
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
</body>
</html>
  `);
});

// Followers page
app.get('/u/:handle/followers', (c) => {
  const handle = c.req.param('handle');
  return c.html(`
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
          document.getElementById('profile-nav').href = '/u/' + meResp.data.handle;
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
</body>
</html>
  `);
});

// Following page
app.get('/u/:handle/following', (c) => {
  const handle = c.req.param('handle');
  return c.html(`
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
          document.getElementById('profile-nav').href = '/u/' + meResp.data.handle;
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
</body>
</html>
  `);
});

// API version info
app.get('/api', (c) => {
  return c.json({
    success: true,
    data: {
      name: 'The Wire API',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth/*',
        users: '/api/users/*',
        posts: '/api/posts/*',
        feed: '/api/feed/*',
        media: '/api/media/*',
        notifications: '/api/notifications/*',
        ws: '/api/ws (WebSocket)',
      },
    },
  });
});

/**
 * WebSocket endpoint - Upgrade to WebSocket connection
 * Query param: token (JWT for authentication)
 */
app.get('/api/ws', async (c) => {
  const token = c.req.query('token');
  
  if (!token) {
    return c.json({ success: false, error: 'Token required' }, 401);
  }

  // Verify JWT
  const { verifyToken } = await import('./utils/jwt');
  const { getJwtSecret } = await import('./middleware/auth');
  
  try {
    const secret = getJwtSecret(c.env);
    const payload = await verifyToken(token, secret);
    
    if (!payload) {
      return c.json({ success: false, error: 'Invalid token' }, 401);
    }

    // Check if user is banned
    const userDoId = c.env.USER_DO.idFromName(payload.sub);
    const userStub = c.env.USER_DO.get(userDoId);
    const bannedResp = await userStub.fetch('https://do.internal/is-banned');
    const bannedData = await bannedResp.json() as { isBanned: boolean };
    
    if (bannedData.isBanned) {
      return c.json({ success: false, error: 'Account banned' }, 403);
    }

    // Forward to user's WebSocketDO preserving upgrade semantics
    const wsDoId = c.env.WEBSOCKET_DO.idFromName(payload.sub);
    const wsStub = c.env.WEBSOCKET_DO.get(wsDoId);
    
    // Clone original request with /connect path
    const originalReq = c.req.raw;
    const url = new URL(originalReq.url);
    url.pathname = '/connect';
    const forwardedReq = new Request(url.toString(), originalReq);
    
    return await wsStub.fetch(forwardedReq);
  } catch (error) {
    console.error('WebSocket auth error:', error);
    return c.json({ success: false, error: 'Authentication failed' }, 401);
  }
});

// Mount auth routes
app.route('/api/auth', authRoutes);

// Mount users routes
app.route('/api/users', usersRoutes);

// Mount posts routes
app.route('/api/posts', postsRoutes);

// Mount feed routes
app.route('/api/feed', feedRoutes);

// Mount search routes
app.route('/api/search', searchRoutes);

// Mount media routes
app.route('/api/media', mediaRoutes);

// Mount moderation routes (admin only)
app.route('/api/moderation', moderationRoutes);

// Mount admin dashboard routes (admin only)
app.route('/api/admin', adminRoutes);

// Mount notifications routes
app.route('/api/notifications', notificationsRoutes);

// Mount unfurl routes (URL metadata extraction)
app.route('/api/unfurl', unfurlRoutes);

// Mount seed routes (DEBUG ONLY - remove in production)
app.route('/debug', seedRoutes);

// Serve media files
app.route('/media', mediaRoutes);

app.get('/css/styles.css', async (_c) => {
  const css = `/* ============================================
   THE WIRE - MULTI-THEME SYSTEM
   shadcn/ui-inspired theming with Twitter precision
   ============================================ */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* ============================================
   THEME: Twitter (Default - Exact Match)
   Pure black background, Twitter blue accent
   ============================================ */
:root,
[data-theme='twitter'] {
  --background: #000000;
  --foreground: #E7E9EA;
  --muted: #71767B;
  --muted-foreground: #71767B;
  --border: #2F3336;
  --input: #2F3336;
  --primary: #1D9BF0;
  --primary-foreground: #FFFFFF;
  --secondary: #16181C;
  --secondary-foreground: #E7E9EA;
  --accent: #16181C;
  --accent-foreground: #E7E9EA;
  --destructive: #F4212E;
  --destructive-foreground: #FFFFFF;
  --hover: #16181C;
  --success: #00BA7C;
  
  --radius: 16px;
  --radius-sm: 8px;
  --radius-lg: 9999px;
  
  --sidebar-left-width: 275px;
  --main-content-width: 600px;
  --sidebar-right-width: 350px;
  
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  
  --transition: all 0.2s ease;
}

/* ============================================
   THEME: Vega (Classic shadcn)
   ============================================ */
[data-theme='vega'] {
  --background: #FFFFFF;
  --foreground: #0F172A;
  --muted: #F1F5F9;
  --muted-foreground: #64748B;
  --border: #E2E8F0;
  --input: #E2E8F0;
  --primary: #0F172A;
  --primary-foreground: #F8FAFC;
  --secondary: #F1F5F9;
  --secondary-foreground: #0F172A;
  --accent: #F1F5F9;
  --accent-foreground: #0F172A;
  --destructive: #EF4444;
  --destructive-foreground: #FFFFFF;
  --hover: #F8FAFC;
  --success: #10B981;
  
  --radius: 8px;
  --radius-sm: 4px;
  --radius-lg: 12px;
  
  --sidebar-left-width: 275px;
  --main-content-width: 600px;
  --sidebar-right-width: 350px;
}

/* ============================================
   THEME: Nova (Compact)
   ============================================ */
[data-theme='nova'] {
  --background: #FAFAFA;
  --foreground: #171717;
  --muted: #F5F5F5;
  --muted-foreground: #737373;
  --border: #E5E5E5;
  --input: #E5E5E5;
  --primary: #18181B;
  --primary-foreground: #FAFAFA;
  --secondary: #F5F5F5;
  --secondary-foreground: #18181B;
  --accent: #F5F5F5;
  --accent-foreground: #18181B;
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;
  --hover: #FAFAFA;
  --success: #16A34A;
  
  --radius: 6px;
  --radius-sm: 3px;
  --radius-lg: 8px;
  
  --sidebar-left-width: 240px;
  --main-content-width: 580px;
  --sidebar-right-width: 320px;
}

/* ============================================
   THEME: Maia (Soft & Rounded)
   ============================================ */
[data-theme='maia'] {
  --background: #FEFEFE;
  --foreground: #2D3748;
  --muted: #F7FAFC;
  --muted-foreground: #718096;
  --border: #E2E8F0;
  --input: #EDF2F7;
  --primary: #4299E1;
  --primary-foreground: #FFFFFF;
  --secondary: #EDF2F7;
  --secondary-foreground: #2D3748;
  --accent: #BEE3F8;
  --accent-foreground: #2C5282;
  --destructive: #F56565;
  --destructive-foreground: #FFFFFF;
  --hover: #F7FAFC;
  --success: #48BB78;
  
  --radius: 16px;
  --radius-sm: 12px;
  --radius-lg: 24px;
  
  --sidebar-left-width: 275px;
  --main-content-width: 600px;
  --sidebar-right-width: 350px;
}

/* ============================================
   THEME: Lyra (Boxy & Mono)
   ============================================ */
[data-theme='lyra'] {
  --background: #FFFFFF;
  --foreground: #000000;
  --muted: #F5F5F5;
  --muted-foreground: #666666;
  --border: #000000;
  --input: #FFFFFF;
  --primary: #000000;
  --primary-foreground: #FFFFFF;
  --secondary: #F5F5F5;
  --secondary-foreground: #000000;
  --accent: #EEEEEE;
  --accent-foreground: #000000;
  --destructive: #FF0000;
  --destructive-foreground: #FFFFFF;
  --hover: #F5F5F5;
  --success: #00CC00;
  
  --radius: 2px;
  --radius-sm: 0px;
  --radius-lg: 4px;
  
  --font-sans: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  
  --sidebar-left-width: 275px;
  --main-content-width: 600px;
  --sidebar-right-width: 350px;
}

/* ============================================
   THEME: Mira (Ultra Dense)
   ============================================ */
[data-theme='mira'] {
  --background: #FCFCFC;
  --foreground: #1A1A1A;
  --muted: #F0F0F0;
  --muted-foreground: #6B6B6B;
  --border: #DEDEDE;
  --input: #F0F0F0;
  --primary: #2563EB;
  --primary-foreground: #FFFFFF;
  --secondary: #F0F0F0;
  --secondary-foreground: #1A1A1A;
  --accent: #DBEAFE;
  --accent-foreground: #1E40AF;
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;
  --hover: #FAFAFA;
  --success: #059669;
  
  --radius: 4px;
  --radius-sm: 2px;
  --radius-lg: 6px;
  
  --sidebar-left-width: 220px;
  --main-content-width: 560px;
  --sidebar-right-width: 300px;
}

/* ============================================
   BASE STYLES
   ============================================ */
body {
  font-family: var(--font-sans);
  background: var(--background);
  color: var(--foreground);
  font-size: 15px;
  line-height: 20px;
}

/* ============================================
   LAYOUT - 3 COLUMN TWITTER STRUCTURE
   ============================================ */
.twitter-layout {
  display: flex;
  max-width: 1265px;
  margin: 0 auto;
  min-height: 100vh;
}

.sidebar-left {
  width: var(--sidebar-left-width);
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

[data-theme='nova'] .sidebar-left,
[data-theme='mira'] .sidebar-left {
  padding: 0 8px;
}

[data-theme='maia'] .sidebar-left {
  padding: 0 16px;
}

.logo {
  padding: 12px;
  margin-bottom: 4px;
  cursor: pointer;
  text-decoration: none;
}

[data-theme='mira'] .logo {
  padding: 6px;
}

.logo svg {
  width: 30px;
  height: 30px;
  stroke: var(--foreground);
  fill: none;
  stroke-width: 2;
}

.logo .logo-text {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: -0.5px;
  white-space: nowrap;
  padding-top: 8px;
  display: block;
}

.logo:hover .logo-text {
  color: var(--primary);
}

[data-theme='nova'] .logo svg,
[data-theme='mira'] .logo svg {
  width: 24px;
  height: 24px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--foreground);
  font-size: 20px;
  font-weight: 400;
  margin-bottom: 4px;
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid transparent;
}

[data-theme='nova'] .nav-item,
[data-theme='mira'] .nav-item {
  padding: 8px 12px;
  font-size: 16px;
}

[data-theme='maia'] .nav-item {
  padding: 14px 20px;
  margin-bottom: 8px;
}

[data-theme='lyra'] .nav-item {
  border-radius: var(--radius);
}

.nav-item:hover {
  background: var(--hover);
}

[data-theme='lyra'] .nav-item:hover {
  border-color: var(--border);
  background: transparent;
}

.nav-item.active {
  font-weight: 700;
}

.nav-item svg {
  width: 26px;
  height: 26px;
  margin-right: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  flex-shrink: 0;
}

[data-theme='nova'] .nav-item svg,
[data-theme='mira'] .nav-item svg {
  width: 20px;
  height: 20px;
  margin-right: 12px;
}

[data-theme='maia'] .nav-item svg {
  width: 28px;
  height: 28px;
  margin-right: 24px;
}

/* Notification badge wrapper - contains icon and badge */
.nav-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-right: 20px;
}

[data-theme='nova'] .nav-icon-wrapper,
[data-theme='mira'] .nav-icon-wrapper {
  margin-right: 12px;
}

[data-theme='maia'] .nav-icon-wrapper {
  margin-right: 24px;
}

.nav-icon-wrapper svg {
  margin-right: 0 !important;
}

/* Notification badge - positioned top-right of the icon */
.notification-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 11px;
  font-weight: 700;
  border-radius: 9px;
  display: none;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-sizing: border-box;
}

.notification-badge.show {
  display: flex;
}

.post-button {
  background: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: var(--radius-lg);
  padding: 16px;
  font-size: 17px;
  font-weight: 700;
  width: 90%;
  margin: 16px auto;
  cursor: pointer;
  transition: var(--transition);
}

[data-theme='nova'] .post-button,
[data-theme='mira'] .post-button {
  padding: 10px;
  font-size: 15px;
  margin: 8px auto;
}

[data-theme='maia'] .post-button {
  padding: 18px;
  margin: 20px auto;
}

[data-theme='lyra'] .post-button {
  border-radius: var(--radius);
  border: 2px solid var(--border);
}

.post-button:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

[data-theme='lyra'] .post-button:hover {
  transform: none;
}

.main-content {
  width: var(--main-content-width);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  min-height: 100vh;
}

[data-theme='lyra'] .main-content {
  border-width: 2px;
}

.sidebar-right {
  width: var(--sidebar-right-width);
  padding: 0 16px;
}

[data-theme='nova'] .sidebar-right,
[data-theme='mira'] .sidebar-right {
  padding: 0 12px;
}

[data-theme='maia'] .sidebar-right {
  padding: 0 20px;
}

/* ============================================
   HEADER
   ============================================ */
.page-header {
  position: sticky;
  top: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
  height: 53px;
  display: flex;
  align-items: center;
  z-index: 10;
}

[data-theme='vega'] .page-header,
[data-theme='nova'] .page-header,
[data-theme='maia'] .page-header,
[data-theme='lyra'] .page-header,
[data-theme='mira'] .page-header {
  background: var(--background);
  backdrop-filter: none;
}

[data-theme='nova'] .page-header,
[data-theme='mira'] .page-header {
  height: 48px;
  padding: 0 12px;
}

[data-theme='lyra'] .page-header {
  border-width: 2px;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 800;
  color: var(--foreground);
}

[data-theme='nova'] .page-header h2,
[data-theme='mira'] .page-header h2 {
  font-size: 18px;
}

.page-header button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
  margin-right: 24px;
  color: var(--foreground);
  padding: 8px;
  border-radius: var(--radius-lg);
  transition: var(--transition);
}

.page-header button:hover {
  background: var(--hover);
}

/* ============================================
   TABS
   ============================================ */
.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}

[data-theme='lyra'] .tabs {
  border-width: 2px;
}

.tab {
  flex: 1;
  padding: 16px;
  text-align: center;
  font-weight: 500;
  color: var(--muted-foreground);
  cursor: pointer;
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
  transition: var(--transition);
}

[data-theme='nova'] .tab,
[data-theme='mira'] .tab {
  padding: 12px 8px;
  font-size: 14px;
}

[data-theme='maia'] .tab {
  padding: 20px;
}

.tab:hover {
  background: var(--hover);
}

.tab.active {
  font-weight: 700;
  color: var(--foreground);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 4px;
  background: var(--primary);
  border-radius: var(--radius-sm);
}

[data-theme='lyra'] .tab.active::after {
  border-radius: 0;
  height: 2px;
}

/* ============================================
   SEARCH BOX
   ============================================ */
.search-box {
  position: sticky;
  top: 0;
  background: var(--background);
  padding: 4px 0 16px;
  z-index: 5;
}

[data-theme='nova'] .search-box,
[data-theme='mira'] .search-box {
  padding: 4px 0 8px;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 48px;
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  background: var(--muted);
  font-size: 15px;
  color: var(--foreground);
  transition: var(--transition);
  font-family: var(--font-sans);
}

[data-theme='nova'] .search-input,
[data-theme='mira'] .search-input {
  padding: 8px 12px 8px 36px;
  font-size: 14px;
}

[data-theme='lyra'] .search-input {
  border-color: var(--border);
  border-width: 2px;
  background: var(--background);
}

.search-input:focus {
  outline: 2px solid var(--primary);
  background: var(--background);
  border-color: var(--primary);
}

[data-theme='lyra'] .search-input:focus {
  outline-offset: 0;
}

/* ============================================
   COMPOSE BOX
   ============================================ */
.compose-box {
  border-bottom: 1px solid var(--border);
  padding: 12px 16px 16px;
}

[data-theme='nova'] .compose-box,
[data-theme='mira'] .compose-box {
  padding: 8px 12px 12px;
}

[data-theme='maia'] .compose-box {
  padding: 16px 24px 20px;
}

[data-theme='lyra'] .compose-box {
  border-width: 2px;
}

.compose-box textarea {
  width: 100%;
  border: none;
  font-size: 20px;
  font-family: var(--font-sans);
  resize: none;
  min-height: 120px;
  margin-top: 8px;
  color: var(--foreground);
  background: transparent;
}

[data-theme='nova'] .compose-box textarea,
[data-theme='mira'] .compose-box textarea {
  font-size: 16px;
  min-height: 80px;
}

[data-theme='lyra'] .compose-box textarea {
  font-family: var(--font-mono);
  font-size: 14px;
}

.compose-box textarea::placeholder {
  color: var(--muted-foreground);
}

.compose-box textarea:focus {
  outline: none;
}

.compose-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

[data-theme='nova'] .compose-footer,
[data-theme='mira'] .compose-footer {
  padding-top: 8px;
}

[data-theme='lyra'] .compose-footer {
  border-width: 2px;
}

.compose-actions {
  display: flex;
  gap: 4px;
}

.icon-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: var(--transition);
}

[data-theme='nova'] .icon-button,
[data-theme='mira'] .icon-button {
  width: 32px;
  height: 32px;
  font-size: 18px;
}

[data-theme='lyra'] .icon-button {
  border-radius: var(--radius);
}

.icon-button:hover {
  background: var(--accent);
}

[data-theme='lyra'] .icon-button:hover {
  border: 2px solid var(--border);
  background: transparent;
}

/* ============================================
   REPLY COMPOSER
   ============================================ */
.replying-to {
  color: var(--muted-foreground);
  font-size: 14px;
  margin-bottom: 12px;
  padding-left: 52px;
}

.replying-to-link {
  color: var(--primary);
  text-decoration: none;
}

.replying-to-link:hover {
  text-decoration: underline;
}

.reply-compose-box {
  padding: 12px 16px;
}

.reply-input-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.reply-input-row .avatar {
  flex-shrink: 0;
}

.reply-form {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.reply-compose-box textarea {
  min-height: 52px;
  font-size: 17px;
  padding: 8px 0;
  margin-top: 0;
}

.reply-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.reply-submit-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.media-preview {
  position: relative;
  margin: 12px 0;
  display: inline-block;
  width: 100%;
}

.media-preview img,
.media-preview video {
  width: 100%;
  max-height: 400px;
  border-radius: 16px;
  object-fit: cover;
}

.remove-media {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(15, 20, 25, 0.75);
  backdrop-filter: blur(4px);
  color: white;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.remove-media:hover {
  background: rgba(15, 20, 25, 0.9);
}

.tweet-button {
  background: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: var(--radius-lg);
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 700;
  min-width: 80px;
  cursor: pointer;
  transition: var(--transition);
}

[data-theme='nova'] .tweet-button,
[data-theme='mira'] .tweet-button {
  padding: 6px 12px;
  font-size: 14px;
  min-width: 70px;
}

[data-theme='lyra'] .tweet-button {
  border-radius: var(--radius);
  border: 2px solid var(--border);
}

.tweet-button:hover:not(:disabled) {
  opacity: 0.9;
}

.tweet-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ============================================
   POST CARDS
   ============================================ */
.post-card {
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
  cursor: pointer;
  transition: var(--transition);
}

[data-theme='nova'] .post-card,
[data-theme='mira'] .post-card {
  padding: 8px 12px;
}

[data-theme='maia'] .post-card {
  padding: 16px 20px;
}

[data-theme='lyra'] .post-card {
  border-width: 2px;
}

.post-card:hover {
  background: var(--hover);
}

.post-header {
  display: flex;
  gap: 12px;
}

[data-theme='nova'] .post-header,
[data-theme='mira'] .post-header {
  gap: 8px;
}

[data-theme='maia'] .post-header {
  gap: 16px;
}

/* ============================================
   AVATARS
   ============================================ */
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--muted);
}

[data-theme='nova'] .avatar,
[data-theme='mira'] .avatar {
  width: 40px;
  height: 40px;
}

[data-theme='lyra'] .avatar {
  border-radius: var(--radius);
}

.avatar-sm {
  width: 32px;
  height: 32px;
}

.avatar-lg {
  width: 134px;
  height: 134px;
  border: 4px solid var(--background);
  margin-top: -15%;
  position: relative;
}

[data-theme='nova'] .avatar-lg,
[data-theme='mira'] .avatar-lg {
  width: 96px;
  height: 96px;
  border-width: 3px;
}

[data-theme='maia'] .avatar-lg {
  width: 148px;
  height: 148px;
  border-width: 6px;
}

/* ============================================
   POST CONTENT
   ============================================ */
.post-body {
  flex: 1;
  min-width: 0;
}

.post-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.post-author-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 2px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.post-menu-container {
  position: relative;
  flex-shrink: 0;
}

.post-more-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  margin-top: -4px;
}

.post-more-btn:hover {
  background: var(--accent);
  color: var(--primary);
}

.post-more-btn svg {
  width: 18px;
  height: 18px;
}

.post-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-width: 220px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-8px);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
}

.post-dropdown.open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.post-dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 500;
  color: var(--foreground);
  cursor: pointer;
  transition: var(--transition);
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
}

.post-dropdown-item:hover {
  background: var(--hover);
}

.post-dropdown-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.post-dropdown-item.destructive {
  color: var(--destructive);
}

.post-dropdown-item.destructive:hover {
  background: rgba(244, 33, 46, 0.1);
}

.post-dropdown-item .follow-text {
  flex: 1;
}

.dropdown-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.dropdown-backdrop.hidden {
  display: none;
}

.post-author {
  font-weight: 700;
  color: var(--foreground);
  font-size: 15px;
  text-decoration: none;
}

[data-theme='nova'] .post-author,
[data-theme='mira'] .post-author {
  font-size: 14px;
}

.post-author:hover {
  text-decoration: underline;
}

.post-handle {
  color: var(--muted-foreground);
  font-size: 15px;
  text-decoration: none;
}

[data-theme='nova'] .post-handle,
[data-theme='mira'] .post-handle {
  font-size: 14px;
}

.post-handle:hover {
  text-decoration: underline;
}

.post-timestamp {
  color: var(--muted-foreground);
  font-size: 15px;
}

[data-theme='nova'] .post-timestamp,
[data-theme='mira'] .post-timestamp {
  font-size: 14px;
}

.post-timestamp::before {
  content: '·';
  margin: 0 4px;
}

.post-content {
  font-size: 15px;
  line-height: 20px;
  color: var(--foreground);
  margin-top: 2px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

[data-theme='nova'] .post-content,
[data-theme='mira'] .post-content {
  font-size: 14px;
  line-height: 18px;
}

[data-theme='lyra'] .post-content {
  font-family: var(--font-mono);
  font-size: 13px;
}

/* Mentions - Twitter-style blue links */
a.mention,
a.mention:link,
a.mention:visited {
  color: var(--primary) !important;
  text-decoration: none !important;
  font-weight: inherit;
}

a.mention:hover,
a.mention:active {
  text-decoration: underline !important;
}

/* Repost indicator */
.repost-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 400;
  padding: 12px 16px 0 56px;
}

.repost-indicator svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.post-media {
  margin-top: 12px;
  border-radius: 16px;
  overflow: hidden;
}

.post-media-item {
  width: 100%;
  max-height: 500px;
  object-fit: cover;
  display: block;
}

/* ============================================
   POST ACTIONS
   ============================================ */
.post-actions {
  display: flex;
  justify-content: space-between;
  max-width: 425px;
  margin-top: 12px;
}

[data-theme='nova'] .post-actions,
[data-theme='mira'] .post-actions {
  margin-top: 8px;
  max-width: 350px;
}

.post-action {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted-foreground);
  font-size: 13px;
  padding: 8px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: var(--transition);
}

[data-theme='nova'] .post-action,
[data-theme='mira'] .post-action {
  padding: 4px 6px;
  font-size: 12px;
}

[data-theme='lyra'] .post-action {
  border-radius: var(--radius);
}

.post-action svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
}

[data-theme='nova'] .post-action svg,
[data-theme='mira'] .post-action svg {
  width: 16px;
  height: 16px;
}

.post-action:hover {
  background: var(--accent);
  color: var(--primary);
}

.post-action.liked {
  color: #F91880;
}

.post-action.liked svg {
  fill: #F91880;
}

.post-action.liked:hover {
  background: rgba(249, 24, 128, 0.1);
}

.post-action.reposted {
  color: #00BA7C;
}

.post-action.reposted svg {
  stroke: #00BA7C;
}

.post-action.reposted:hover {
  background: rgba(0, 186, 124, 0.1);
}

/* ============================================
   PROFILE
   ============================================ */
.profile-header {
  position: relative;
}

.profile-banner {
  width: 100%;
  height: 200px;
  background: var(--muted);
  object-fit: cover;
}

[data-theme='nova'] .profile-banner,
[data-theme='mira'] .profile-banner {
  height: 150px;
}

[data-theme='maia'] .profile-banner {
  height: 240px;
}

.profile-info {
  padding: 12px 16px;
}

[data-theme='nova'] .profile-info,
[data-theme='mira'] .profile-info {
  padding: 8px 12px;
}

[data-theme='maia'] .profile-info {
  padding: 16px 24px;
}

.profile-actions-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.profile-name {
  font-size: 20px;
  font-weight: 800;
  line-height: 24px;
  color: var(--foreground);
}

[data-theme='nova'] .profile-name,
[data-theme='mira'] .profile-name {
  font-size: 18px;
  line-height: 22px;
}

.profile-handle {
  font-size: 15px;
  color: var(--muted-foreground);
  margin-bottom: 12px;
}

[data-theme='nova'] .profile-handle,
[data-theme='mira'] .profile-handle {
  font-size: 14px;
  margin-bottom: 8px;
}

.profile-bio {
  font-size: 15px;
  line-height: 20px;
  margin-bottom: 12px;
}

[data-theme='nova'] .profile-bio,
[data-theme='mira'] .profile-bio {
  font-size: 14px;
  line-height: 18px;
  margin-bottom: 8px;
}

[data-theme='lyra'] .profile-bio {
  font-family: var(--font-mono);
  font-size: 13px;
}

.profile-meta {
  display: flex;
  gap: 12px;
  color: var(--muted-foreground);
  font-size: 15px;
  margin-bottom: 12px;
}

[data-theme='nova'] .profile-meta,
[data-theme='mira'] .profile-meta {
  font-size: 14px;
  gap: 8px;
  margin-bottom: 8px;
}

.profile-stats {
  display: flex;
  gap: 20px;
  font-size: 15px;
}

[data-theme='nova'] .profile-stats,
[data-theme='mira'] .profile-stats {
  gap: 12px;
  font-size: 14px;
}

.profile-stat {
  color: var(--muted-foreground);
  cursor: pointer;
}

.profile-stat strong {
  color: var(--foreground);
  font-weight: 700;
}

.profile-stat:hover {
  text-decoration: underline;
}

/* ============================================
   USER CARDS (for followers/following lists)
   ============================================ */
.user-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: var(--transition);
}

.user-card:hover {
  background: var(--secondary);
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--muted);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.user-display-name {
  font-weight: 700;
  color: var(--foreground);
}

.user-handle {
  color: var(--muted-foreground);
  font-size: 14px;
}

.user-bio {
  margin-top: 4px;
  font-size: 14px;
  color: var(--foreground);
  line-height: 1.4;
}

.mutual-badge {
  font-size: 12px;
  color: var(--primary);
  background: var(--primary-alpha);
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 500;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--foreground);
  transition: var(--transition);
}

.back-button:hover {
  background: var(--secondary);
}

.page-title {
  margin-left: 16px;
}

.page-title h2 {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.page-title .subtitle {
  font-size: 13px;
  color: var(--muted-foreground);
}

/* ============================================
   BUTTONS
   ============================================ */
.btn-primary {
  background: var(--foreground);
  color: var(--background);
  border: none;
  border-radius: var(--radius-lg);
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  min-width: 100px;
  transition: var(--transition);
}

[data-theme='twitter'] .btn-primary {
  background: var(--foreground);
  color: var(--background);
}

[data-theme='vega'] .btn-primary,
[data-theme='nova'] .btn-primary,
[data-theme='maia'] .btn-primary,
[data-theme='lyra'] .btn-primary,
[data-theme='mira'] .btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
}

[data-theme='nova'] .btn-primary,
[data-theme='mira'] .btn-primary {
  padding: 6px 12px;
  font-size: 14px;
  min-width: 80px;
}

[data-theme='lyra'] .btn-primary {
  border-radius: var(--radius);
  border: 2px solid var(--border);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: transparent;
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  min-width: 100px;
  transition: var(--transition);
}

[data-theme='nova'] .btn-secondary,
[data-theme='mira'] .btn-secondary {
  padding: 6px 12px;
  font-size: 14px;
  min-width: 80px;
}

[data-theme='lyra'] .btn-secondary {
  border-width: 2px;
  border-radius: var(--radius);
}

.btn-secondary:hover {
  background: var(--hover);
}

/* ============================================
   WIDGETS (Right Sidebar)
   ============================================ */
.widget-box {
  background: var(--muted);
  border-radius: var(--radius);
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid var(--border);
}

[data-theme='nova'] .widget-box,
[data-theme='mira'] .widget-box {
  margin-bottom: 12px;
}

[data-theme='maia'] .widget-box {
  margin-bottom: 20px;
}

[data-theme='lyra'] .widget-box {
  border-width: 2px;
}

.widget-header {
  padding: 12px 16px;
  font-size: 20px;
  font-weight: 800;
  color: var(--foreground);
  border-bottom: 1px solid var(--border);
}

[data-theme='nova'] .widget-header,
[data-theme='mira'] .widget-header {
  padding: 8px 12px;
  font-size: 16px;
}

[data-theme='lyra'] .widget-header {
  border-width: 2px;
}

.widget-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: var(--transition);
  border-bottom: 1px solid var(--border);
}

[data-theme='nova'] .widget-item,
[data-theme='mira'] .widget-item {
  padding: 8px 12px;
}

.widget-item:last-child {
  border-bottom: none;
}

.widget-item:hover {
  background: var(--hover);
}

.widget-item-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--foreground);
  margin-bottom: 2px;
}

[data-theme='nova'] .widget-item-title,
[data-theme='mira'] .widget-item-title {
  font-size: 14px;
}

.widget-item-meta {
  font-size: 13px;
  color: var(--muted-foreground);
}

[data-theme='nova'] .widget-item-meta,
[data-theme='mira'] .widget-item-meta {
  font-size: 12px;
}

/* ============================================
   AUTH PAGES
   ============================================ */
.auth-container {
  max-width: 600px;
  margin: 48px auto;
  padding: 48px;
  background: var(--background);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
  border: 1px solid var(--border);
}

[data-theme='twitter'] .auth-container {
  background: #000000;
  border-color: var(--border);
}

[data-theme='nova'] .auth-container,
[data-theme='mira'] .auth-container {
  padding: 32px;
  margin: 32px auto;
}

[data-theme='lyra'] .auth-container {
  box-shadow: none;
  border-width: 2px;
}

.form-group {
  margin-bottom: 20px;
}

[data-theme='nova'] .form-group,
[data-theme='mira'] .form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted-foreground);
  margin-bottom: 8px;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 17px;
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-sans);
  transition: var(--transition);
}

[data-theme='nova'] .form-group input,
[data-theme='nova'] .form-group textarea,
[data-theme='mira'] .form-group input,
[data-theme='mira'] .form-group textarea {
  padding: 8px 12px;
  font-size: 15px;
}

[data-theme='lyra'] .form-group input,
[data-theme='lyra'] .form-group textarea {
  border-width: 2px;
  font-family: var(--font-mono);
  font-size: 14px;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: 2px solid var(--primary);
  border-color: var(--primary);
}

[data-theme='lyra'] .form-group input:focus,
[data-theme='lyra'] .form-group textarea:focus {
  outline-offset: 0;
}

/* ============================================
   MESSAGES
   ============================================ */
.error {
  color: var(--destructive);
  font-size: 13px;
  margin-top: 8px;
}

.success {
  color: var(--success);
  font-size: 13px;
  margin-top: 8px;
}

.empty-state {
  padding: 32px;
  text-align: center;
  color: var(--muted-foreground);
}

[data-theme='nova'] .empty-state,
[data-theme='mira'] .empty-state {
  padding: 24px;
}

/* ============================================
   THEME SWITCHER
   ============================================ */
.theme-switcher {
  margin: 20px 0;
}

.theme-switcher-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--foreground);
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

[data-theme='mira'] .theme-options {
  gap: 8px;
}

.theme-option {
  padding: 16px;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  text-align: center;
  transition: var(--transition);
  background: var(--background);
}

[data-theme='nova'] .theme-option,
[data-theme='mira'] .theme-option {
  padding: 12px;
}

.theme-option:hover {
  border-color: var(--primary);
  background: var(--hover);
}

.theme-option.active {
  border-color: var(--primary);
  background: var(--accent);
}

.theme-option-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.theme-option-desc {
  font-size: 12px;
  color: var(--muted-foreground);
}

/* ============================================
   SETTINGS PAGE
   ============================================ */
.settings-section {
  border-bottom: 1px solid var(--border);
  padding: 20px 0;
}

[data-theme='lyra'] .settings-section {
  border-width: 2px;
}

.settings-section h3 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--foreground);
}

[data-theme='nova'] .settings-section h3,
[data-theme='mira'] .settings-section h3 {
  font-size: 18px;
  margin-bottom: 12px;
}

/* Profile Media Editor - X-style banner/avatar with camera overlays */
.profile-media-editor {
  position: relative;
  margin-bottom: 24px;
  padding-bottom: 50px;
}

.banner-editor {
  position: relative;
  height: 150px;
  background: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  overflow: hidden;
}

.banner-preview {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-color: var(--muted);
}

.avatar-editor-wrapper {
  position: absolute;
  left: 16px;
  bottom: 6px;
  z-index: 2;
}

.avatar-editor {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 4px solid var(--background);
  background: var(--muted);
  overflow: hidden;
}

.avatar-preview {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-color: var(--muted);
}

.media-edit-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: background 0.2s ease;
  z-index: 3;
}

.media-edit-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.avatar-editor .media-edit-btn {
  width: 36px;
  height: 36px;
}

.banner-editor.uploading .banner-preview,
.avatar-editor.uploading .avatar-preview {
  opacity: 0.5;
}

.media-upload-status {
  padding: 8px 16px;
  font-size: 14px;
  text-align: center;
  min-height: 24px;
}

.media-upload-status.uploading {
  color: var(--primary);
}

.media-upload-status.success {
  color: #22c55e;
}

.media-upload-status.error {
  color: var(--destructive);
}

/* User Cards - Following/Followers List */
.user-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s ease;
}

.user-card:hover {
  background: var(--hover);
}

.user-card-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  background: var(--muted);
}

.user-card-avatar-placeholder {
  background: var(--muted);
}

.user-card-content {
  flex: 1;
  min-width: 0;
}

.user-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.user-card-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--foreground);
}

.user-card-handle {
  font-size: 15px;
  color: var(--muted-foreground);
}

.user-card-bio {
  font-size: 15px;
  color: var(--foreground);
  margin-top: 4px;
  line-height: 1.4;
}

.follows-you-badge {
  font-size: 12px;
  color: var(--muted-foreground);
  background: var(--muted);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 400;
}

.following-badge {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  background: transparent;
  border: 1px solid var(--border);
  padding: 6px 16px;
  border-radius: 9999px;
  margin-left: auto;
  flex-shrink: 0;
}

/* ============================================
   UTILITIES
   ============================================ */
.text-center { text-align: center; }
.mt-1 { margin-top: 8px; }
.mb-1 { margin-bottom: 8px; }
.text-muted { color: var(--muted-foreground); }

.link {
  color: var(--primary);
  text-decoration: none;
  transition: var(--transition);
}

.link:hover {
  text-decoration: underline;
}

small {
  font-size: 13px;
  color: var(--muted-foreground);
  display: block;
  margin-top: 4px;
}

[data-theme='nova'] small,
[data-theme='mira'] small {
  font-size: 12px;
}

.char-counter {
  font-size: 13px;
  color: var(--muted-foreground);
}

[data-theme='nova'] .char-counter,
[data-theme='mira'] .char-counter {
  font-size: 12px;
}

.char-counter.warning {
  color: #FFD400;
}

.char-counter.error {
  color: var(--destructive);
}

/* ============================================
   CONTAINER FOR NON-TWITTER LAYOUTS
   ============================================ */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

[data-theme='nova'] .container,
[data-theme='mira'] .container {
  padding: 1rem;
}

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

[data-theme='lyra'] .nav-bar {
  border-width: 2px;
}

.nav-links {
  display: flex;
  gap: 1rem;
}

.nav-links button {
  background: var(--secondary);
  color: var(--secondary-foreground);
  width: auto;
  padding: 8px 16px;
}

[data-theme='nova'] .nav-links button,
[data-theme='mira'] .nav-links button {
  padding: 6px 12px;
  font-size: 14px;
}

/* ============================================
   RESPONSIVE DESIGN
   ============================================ */
@media (max-width: 1024px) {
  .sidebar-right {
    display: none;
  }
  
  .twitter-layout {
    max-width: 920px;
  }
}

@media (max-width: 768px) {
  .sidebar-left {
    width: 88px;
  }
  
  .nav-item span:not(.nav-icon) {
    display: none;
  }
  
  .nav-item svg {
    margin-right: 0;
  }
  
  .post-button {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    padding: 0;
    font-size: 0;
  }
  
  .post-button::before {
    content: '+';
    font-size: 24px;
  }
}

/* ============================================
   SMOOTH TRANSITIONS
   ============================================ */
* {
  transition-property: background-color, border-color, color;
  transition-duration: 0.3s;
  transition-timing-function: ease;
}

button, a, .nav-item, .post-card, .tab, .icon-button {
  transition-property: all;
  transition-duration: 0.2s;
}

/* ============================================
   LINK CARDS (Twitter/X Style)
   ============================================ */
.link-card {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
  display: block;
  color: inherit;
}

.link-card:hover {
  background: var(--hover);
}

.link-card-image {
  width: 100%;
  aspect-ratio: 1.91 / 1;
  object-fit: cover;
  background: var(--muted);
  display: block;
}

.link-card-body {
  padding: 12px;
  border-top: 1px solid var(--border);
}

.link-card-domain {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted-foreground);
  font-size: 13px;
  margin-bottom: 2px;
}

.link-card-domain svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.link-card-title {
  font-size: 15px;
  font-weight: 400;
  color: var(--foreground);
  line-height: 20px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.link-card-description {
  font-size: 15px;
  color: var(--muted-foreground);
  line-height: 20px;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Small card variant (no image or summary card) */
.link-card-small {
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.link-card-small .link-card-image {
  width: 130px;
  min-width: 130px;
  aspect-ratio: 1 / 1;
  border-radius: 16px 0 0 16px;
}

.link-card-small .link-card-body {
  flex: 1;
  border-top: none;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* YouTube embed */
.youtube-embed {
  margin-top: 12px;
  border-radius: 16px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.youtube-embed iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* Link card loading state */
.link-card-loading {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--muted-foreground);
  font-size: 14px;
}

.link-card-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Infinite scroll loading indicator */
.loading-more {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.loading-more .spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}`;

  return new Response(css, {
    headers: { 'Content-Type': 'text/css' },
  });
});

app.get('/js/api.js', (_c) => {
  const js = `const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const response = await fetch(API_BASE + endpoint, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

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

const users = {
  async getProfile(handle) {
    return await apiRequest('/users/' + handle);
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

const posts = {
  async create(content, mediaUrls = [], replyToId = null, quoteOfId = null) {
    return await apiRequest('/posts', {
      method: 'POST',
      body: JSON.stringify({ content, mediaUrls, replyToId, quoteOfId }),
    });
  },

  async get(postId) {
    return await apiRequest('/posts/' + postId);
  },

  async delete(postId) {
    return await apiRequest('/posts/' + postId, {
      method: 'DELETE',
    });
  },

  async like(postId) {
    return await apiRequest('/posts/' + postId + '/like', {
      method: 'POST',
    });
  },

  async unlike(postId) {
    return await apiRequest('/posts/' + postId + '/like', {
      method: 'DELETE',
    });
  },

  async repost(postId) {
    return await apiRequest('/posts/' + postId + '/repost', {
      method: 'POST',
    });
  },
};

const media = {
  async uploadMedia(file) {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(API_BASE + '/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },

  async uploadAvatar(file) {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(API_BASE + '/media/users/me/avatar', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },

  async uploadBanner(file) {
    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(API_BASE + '/media/users/me/banner', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },
};

const social = {
  async follow(handle) {
    return await apiRequest('/users/' + handle + '/follow', {
      method: 'POST',
    });
  },

  async unfollow(handle) {
    return await apiRequest('/users/' + handle + '/follow', {
      method: 'DELETE',
    });
  },

  async block(handle) {
    return await apiRequest('/users/' + handle + '/block', {
      method: 'POST',
    });
  },

  async unblock(handle) {
    return await apiRequest('/users/' + handle + '/block', {
      method: 'DELETE',
    });
  },

  async getFollowers(handle) {
    return await apiRequest('/users/' + handle + '/followers');
  },

  async getFollowing(handle) {
    return await apiRequest('/users/' + handle + '/following');
  },

  async getBlocked() {
    return await apiRequest('/users/me/blocked');
  },
};

const notifications = {
  async getAll(cursor, limit = 20) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    return await apiRequest('/notifications?' + params.toString());
  },

  async getUnreadCount() {
    return await apiRequest('/notifications/unread-count');
  },

  async markAsRead(notificationId) {
    return await apiRequest('/notifications/' + notificationId + '/read', {
      method: 'PUT',
    });
  },

  async markAllAsRead() {
    return await apiRequest('/notifications/read-all', {
      method: 'PUT',
    });
  },
};

const theme = {
  current: 'maia',

  init() {
    const saved = localStorage.getItem('the_wire_theme');
    if (saved) {
      this.apply(saved);
    } else {
      this.apply('maia');
    }
    // Enable transitions only after initial theme is applied
    requestAnimationFrame(() => {
      document.body.classList.add('theme-loaded');
    });
  },
  
  apply(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    this.current = themeName;
    localStorage.setItem('the_wire_theme', themeName);
  },
  
  get() {
    return this.current;
  },
  
  getAll() {
    return [
      { name: 'twitter', display: 'Twitter', desc: 'Pure black, blue accent' },
      { name: 'vega', display: 'Vega', desc: 'Classic shadcn slate' },
      { name: 'nova', display: 'Nova', desc: 'Compact & efficient' },
      { name: 'maia', display: 'Maia', desc: 'Soft & rounded' },
      { name: 'lyra', display: 'Lyra', desc: 'Boxy & monospace' },
      { name: 'mira', display: 'Mira', desc: 'Ultra dense' }
    ];
  }
};

if (typeof window !== 'undefined') {
  theme.init();
}

const ws = {
  socket: null,
  listeners: {},
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  heartbeatInterval: null,
  
  connect() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('Cannot connect WebSocket: No auth token');
      return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host + '/api/ws?token=' + token;
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      
      this.heartbeatInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (this.listeners[data.type]) {
          this.listeners[data.type].forEach(callback => callback(data));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };
    
    this.socket.onclose = () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  },
  
  disconnect() {
    if (this.socket) {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      this.socket.close();
      this.socket = null;
    }
  },
  
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  },
  
  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
    }
  },
};

// Notification badge management
const notificationBadge = {
  count: 0,

  update(count) {
    this.count = count;
    const badge = document.getElementById('notification-badge');

    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.classList.add('show');
      } else {
        badge.classList.remove('show');
      }
    }
  },

  increment() {
    this.update(this.count + 1);
  },

  clear() {
    this.update(0);
  },

  async fetch() {
    if (!auth.isAuthenticated()) return;

    try {
      const response = await notifications.getUnreadCount();
      if (response.success && typeof response.data.count === 'number') {
        this.update(response.data.count);
      }
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  }
};

// Initialize notifications on page load
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    if (auth.isAuthenticated()) {
      // Fetch initial unread count
      notificationBadge.fetch();

      // Connect WebSocket and listen for notifications
      ws.connect();
      ws.on('notification', function(data) {
        notificationBadge.increment();
      });

      // If on notifications page, mark all as read after a short delay
      if (window.location.pathname === '/notifications') {
        setTimeout(function() {
          notifications.markAllAsRead().then(function() {
            notificationBadge.clear();
          }).catch(function(err) {
            console.error('Failed to mark notifications as read:', err);
          });
        }, 1000);
      }
    }
  });
}

function linkifyMentions(text) {
  if (!text) return '';
  // Unified mention regex: 3-15 chars, alphanumeric + underscore, case insensitive
  var result = text.replace(/@([a-zA-Z0-9_]{3,15})/gi, '<a href="/u/$1" class="mention" onclick="event.stopPropagation()">@$1</a>');
  result = result.replace(/#([a-zA-Z0-9_]+)/g, '<a href="/search?q=%23$1" class="mention" onclick="event.stopPropagation()">#$1</a>');
  result = result.replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" class="link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>');
  return result;
}`;
  return new Response(js, {
    headers: { 'Content-Type': 'application/javascript' },
  });
});

// 404 fallback - return HTML for browser requests, JSON for API requests
app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  const isApiRequest = path.startsWith('/api/');
  
  if (isApiRequest) {
    return c.json({ success: false, error: 'Not found' }, 404);
  }
  
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css?v=2">
</head>
<body>
  <div class="container">
    <div style="text-align: center; padding: 4rem 0;">
      <h1 style="font-size: 6rem; margin-bottom: 1rem;">404</h1>
      <h2 style="margin-bottom: 2rem;">Page Not Found</h2>
      <p class="text-muted" style="margin-bottom: 2rem;">The page you're looking for doesn't exist.</p>
      <a href="/" class="cta" style="display: inline-block; padding: 1rem 2rem; background: linear-gradient(135deg, #00d9ff 0%, #0077ff 100%); color: #fff; text-decoration: none; border-radius: 50px; font-weight: 600;">Go Home</a>
    </div>
  </div>
</body>
</html>
  `, 404);
});

// Error handler with structured logging
app.onError((err, c) => {
  // Inline structured error logging for production debugging
  const errorLog = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: 'Unhandled request error',
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    context: {
      path: c.req.path,
      method: c.req.method,
      url: c.req.url,
    },
  };
  console.error(JSON.stringify(errorLog));
  return c.json({ success: false, error: 'Internal server error' }, 500);
});

// Export Durable Objects
export { UserDO } from './durable-objects/UserDO';
export { PostDO } from './durable-objects/PostDO';
export { FeedDO } from './durable-objects/FeedDO';
export { WebSocketDO } from './durable-objects/WebSocketDO';

// OPTIMIZED: Helper to process followers in chunks with concurrency control
async function processFanoutChunk<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  concurrency: number = 5
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(chunk.map(processor));
  }
}

// Queue consumer handler for fan-out processing
// OPTIMIZED: Chunks followers, skips duplicate author add, limits concurrency
async function queueHandler(
  batch: MessageBatch<import('./types/feed').FanOutMessage>,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const msg = message.body;

      if (msg.type === 'new_post') {
        // Add to author's own feed first
        const authorFeedId = env.FEED_DO.idFromName(msg.authorId);
        const authorFeedStub = env.FEED_DO.get(authorFeedId);
        await authorFeedStub.fetch('https://do.internal/add-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry: {
              postId: msg.postId,
              authorId: msg.authorId,
              timestamp: msg.timestamp,
              source: 'own',
            },
          }),
        });

        // Get author's followers
        const authorDoId = env.USER_DO.idFromName(msg.authorId);
        const authorStub = env.USER_DO.get(authorDoId);
        const followersResp = await authorStub.fetch('https://do.internal/followers');
        const followersData = await followersResp.json() as { followers: string[] };

        // OPTIMIZED: Filter out author (already added above) to avoid duplicate
        const followers = followersData.followers.filter(id => id !== msg.authorId);

        // Get post metadata once for broadcasts
        const postData = await env.POSTS_KV.get(`post:${msg.postId}`);
        const postMetadata = postData ? JSON.parse(postData) : null;

        // OPTIMIZED: Process followers in chunks of 10 with concurrency of 5
        // This keeps subrequests under control for large follower lists
        await processFanoutChunk(followers, async (followerId) => {
          const feedId = env.FEED_DO.idFromName(followerId);
          const feedStub = env.FEED_DO.get(feedId);

          await feedStub.fetch('https://do.internal/add-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entry: {
                postId: msg.postId,
                authorId: msg.authorId,
                timestamp: msg.timestamp,
                source: 'follow',
              },
            }),
          });

          // Broadcast new post to follower's WebSocket connections
          if (postMetadata) {
            try {
              const wsDoId = env.WEBSOCKET_DO.idFromName(followerId);
              const wsStub = env.WEBSOCKET_DO.get(wsDoId);
              await wsStub.fetch('https://do.internal/broadcast-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post: postMetadata }),
              });
            } catch {
              // Ignore WebSocket broadcast errors - not critical
            }
          }
        }, 5);
      } else if (msg.type === 'delete_post') {
        // Remove from author's feed
        const authorFeedId = env.FEED_DO.idFromName(msg.authorId);
        const authorFeedStub = env.FEED_DO.get(authorFeedId);
        await authorFeedStub.fetch('https://do.internal/remove-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: msg.postId }),
        });

        // Get author's followers and remove from their feeds
        const authorDoId = env.USER_DO.idFromName(msg.authorId);
        const authorStub = env.USER_DO.get(authorDoId);
        const followersResp = await authorStub.fetch('https://do.internal/followers');
        const followersData = await followersResp.json() as { followers: string[] };

        // OPTIMIZED: Filter out author and process in chunks
        const followers = followersData.followers.filter(id => id !== msg.authorId);

        await processFanoutChunk(followers, async (followerId) => {
          const feedId = env.FEED_DO.idFromName(followerId);
          const feedStub = env.FEED_DO.get(feedId);

          await feedStub.fetch('https://do.internal/remove-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: msg.postId }),
          });
        }, 5);
      }

      message.ack();
    } catch (error) {
      console.error('Error processing queue message:', error);
      const backoff = Math.min(3600, 30 ** message.attempts);
      message.retry({ delaySeconds: backoff });
    }
  }
}

// Scheduled handler for cron triggers
async function scheduledHandler(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  await handleScheduled(event, env, ctx);
}

// Export for Cloudflare Workers - all handlers in one object
export default {
  fetch: app.fetch,
  queue: queueHandler,
  scheduled: scheduledHandler,
};
