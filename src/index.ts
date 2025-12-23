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
import notificationsRoutes from './handlers/notifications';
import { rateLimit, RATE_LIMITS } from './middleware/rate-limit';
import { csrfProtection } from './middleware/csrf';
import { handleScheduled } from './handlers/scheduled';

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
app.use('*', csrfProtection());

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
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    .hero {
      text-align: center;
      padding: 4rem 2rem;
      max-width: 600px;
      margin: 0 auto;
    }
    .hero h1 {
      font-size: 4rem;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 800;
    }
    .tagline {
      font-size: 1.5rem;
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
      margin-top: 3rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      max-width: 900px;
      margin: 3rem auto 0;
      padding: 0 2rem;
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
    <div class="logo" style="display: flex; justify-content: center; margin-bottom: 2rem;">
      <svg viewBox="0 0 24 24" style="width: 60px; height: 60px; stroke: var(--foreground); fill: none; stroke-width: 2;"><circle cx="12" cy="12" r="10"/></svg>
    </div>
    <h1>The Wire</h1>
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

  <script src="/js/api.js"></script>
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
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="auth-container">
    <div class="logo" style="text-align: center; margin-bottom: 24px;">
      <svg viewBox="0 0 24 24" style="width: 40px; height: 40px; stroke: var(--foreground); fill: none; stroke-width: 2; margin: 0 auto;"><circle cx="12" cy="12" r="10"/></svg>
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

  <script src="/js/api.js"></script>
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
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="auth-container">
    <div class="logo" style="text-align: center; margin-bottom: 24px;">
      <svg viewBox="0 0 24 24" style="width: 40px; height: 40px; stroke: var(--foreground); fill: none; stroke-width: 2; margin: 0 auto;"><circle cx="12" cy="12" r="10"/></svg>
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

  <script src="/js/api.js"></script>
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
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <a href="/home" class="logo">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
      </a>
      
      <a href="/home" class="nav-item active">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Explore</span>
      </a>
      <a href="/notifications" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
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
      
      <button class="post-button" onclick="document.getElementById('note-content').focus()">Post</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="page-header">
        <h2>Home</h2>
      </div>

      <div class="tabs">
        <button class="tab active">For you</button>
        <button class="tab">Following</button>
      </div>

      <div class="compose-box">
        <div style="display: flex; gap: 12px;">
          <img id="compose-avatar" class="avatar" src="" alt="Your avatar" style="display: none;">
          <div style="flex: 1;">
            <form id="compose-form">
              <textarea 
                id="note-content" 
                placeholder="What's happening?"
                maxlength="280"
              ></textarea>
              <div class="compose-footer">
                <div class="compose-actions">
                  <button type="button" class="icon-button" title="Media">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  </button>
                  <button type="button" class="icon-button" title="Emoji">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
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
        <input type="text" class="search-input" placeholder="Search">
      </div>
      
      <div class="widget-box">
        <div class="widget-header">What's happening</div>
        <div class="widget-item">
          <div class="widget-item-meta">Trending</div>
          <div class="widget-item-title">Example Trend</div>
          <div class="widget-item-meta">1,234 posts</div>
        </div>
      </div>
    </div>
  </div>

  <script src="/js/api.js"></script>
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

    async function loadTimeline() {
      try {
        timeline.innerHTML = '<div class="empty-state">Loading your timeline...</div>';
        
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
        } else {
          timeline.innerHTML = '<div class="empty-state">No posts in your feed yet. Follow some users!</div>';
        }
      } catch (error) {
        console.error('Error loading timeline:', error);
        timeline.innerHTML = '<div class="error">Error loading timeline. Please refresh.</div>';
      }
    }

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
      
      if (length === 0) {
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
      if (!content) return;

      composeError.textContent = '';
      composeSuccess.textContent = '';
      postBtn.disabled = true;
      postBtn.textContent = 'Posting...';

      try {
        const response = await posts.create(content);
        
        if (response.success) {
          composeSuccess.textContent = 'Posted!';
          textarea.value = '';
          charCounter.textContent = '0 / 280';
          charCounter.className = 'char-counter';
          
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

    function renderTimeline(posts) {
      if (!posts || posts.length === 0) {
        timeline.innerHTML = '<div class="empty-state">No posts yet. Follow users to see their posts!</div>';
        return;
      }

      timeline.innerHTML = posts.map(post => {
        const date = new Date(post.createdAt);
        const timeStr = formatTimeAgo(date);
        
        const avatarHtml = post.authorAvatarUrl 
          ? '<img src="' + post.authorAvatarUrl + '" class="avatar" alt="' + post.authorDisplayName + '">'
          : '<div class="avatar" style="background: #1D9BF0;"></div>';
        
        const likedClass = post.hasLiked ? ' liked' : '';
        
        return '<div class="post-card" data-post-id="' + post.id + '" onclick="window.location.href=\\'/post/' + post.id + '\\'">' +
          '<div class="post-header">' +
            '<a href="/u/' + post.authorHandle + '" onclick="event.stopPropagation()">' + avatarHtml + '</a>' +
            '<div class="post-body">' +
              '<div class="post-author-row">' +
                '<a href="/u/' + post.authorHandle + '" class="post-author" onclick="event.stopPropagation()">' + escapeHtml(post.authorDisplayName) + '</a>' +
                '<a href="/u/' + post.authorHandle + '" class="post-handle" onclick="event.stopPropagation()">@' + post.authorHandle + '</a>' +
                '<span class="post-timestamp">' + timeStr + '</span>' +
              '</div>' +
              '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
              '<div class="post-actions" onclick="event.stopPropagation()">' +
                '<span class="post-action">💬 ' + post.replyCount + '</span>' +
                '<span class="post-action">🔁 ' + post.repostCount + '</span>' +
                '<span class="post-action' + likedClass + '" data-action="like" data-post-id="' + post.id + '">' +
                  '❤️ <span class="like-count">' + post.likeCount + '</span>' +
                '</span>' +
                '<span class="post-action">📊</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      document.querySelectorAll('[data-action="like"]').forEach(btn => {
        btn.addEventListener('click', handleLike);
      });
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

    loadTimeline();
    loadUserProfile();
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
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <a href="/home" class="logo">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
      </a>
      
      <a href="/home" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item active">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Explore</span>
      </a>
      <a href="/notifications" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
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

      <div class="tabs">
        <button class="tab active">For you</button>
        <button class="tab">Trending</button>
        <button class="tab">News</button>
        <button class="tab">Sports</button>
      </div>

      <div id="explore-content">
        <div class="empty-state">Loading trending content...</div>
      </div>
    </div>

    <!-- Right Sidebar -->
    <div class="sidebar-right">
      <div class="search-box">
        <input type="text" class="search-input" placeholder="Search">
      </div>
      
      <div class="widget-box">
        <div class="widget-header">Trending</div>
        <div id="trending-topics">
          <div class="widget-item">
            <div class="widget-item-meta">Trending · Technology</div>
            <div class="widget-item-title">#CloudflareWorkers</div>
            <div class="widget-item-meta">2.5K posts</div>
          </div>
          <div class="widget-item">
            <div class="widget-item-meta">Trending · Web Development</div>
            <div class="widget-item-title">#EdgeComputing</div>
            <div class="widget-item-meta">1.8K posts</div>
          </div>
          <div class="widget-item">
            <div class="widget-item-meta">Trending · Programming</div>
            <div class="widget-item-title">#TypeScript</div>
            <div class="widget-item-meta">3.2K posts</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="/js/api.js"></script>
  <script>
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
    if (auth.isAuthenticated()) {
      setProfileLink();
    }

    async function loadExploreFeed() {
      try {
        const headers = {};
        if (auth.isAuthenticated()) {
          headers['Authorization'] = 'Bearer ' + localStorage.getItem('auth_token');
        }
        
        const response = await fetch('/api/feed/global?limit=20', { headers });
        const data = await response.json();
        
        const exploreContent = document.getElementById('explore-content');
        
        if (data.success && data.data.posts && data.data.posts.length > 0) {
          exploreContent.innerHTML = data.data.posts.map(post => {
            const date = new Date(post.createdAt);
            const timeStr = formatTimeAgo(date);
            
            const avatarHtml = post.authorAvatarUrl 
              ? '<img src="' + post.authorAvatarUrl + '" class="avatar" alt="' + post.authorDisplayName + '">'
              : '<div class="avatar" style="background: #1D9BF0;"></div>';
            
            return '<div class="post-card" onclick="window.location.href=\\'/post/' + post.id + '\\'">' +
              '<div class="post-header">' +
                '<a href="/u/' + post.authorHandle + '" onclick="event.stopPropagation()">' + avatarHtml + '</a>' +
                '<div class="post-body">' +
                  '<div class="post-author-row">' +
                    '<a href="/u/' + post.authorHandle + '" class="post-author" onclick="event.stopPropagation()">' + escapeHtml(post.authorDisplayName) + '</a>' +
                    '<a href="/u/' + post.authorHandle + '" class="post-handle" onclick="event.stopPropagation()">@' + post.authorHandle + '</a>' +
                    '<span class="post-timestamp">' + timeStr + '</span>' +
                  '</div>' +
                  '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
                  '<div class="post-actions" onclick="event.stopPropagation()">' +
                    '<span class="post-action">' +
                      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                      ' ' + post.replyCount +
                    '</span>' +
                    '<span class="post-action">' +
                      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
                      ' ' + post.repostCount +
                    '</span>' +
                    '<span class="post-action">' +
                      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
                      ' ' + post.likeCount +
                    '</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('');
        } else {
          exploreContent.innerHTML = '<div class="empty-state">No posts to explore yet.</div>';
        }
      } catch (error) {
        console.error('Error loading explore feed:', error);
        document.getElementById('explore-content').innerHTML = '<div class="error">Error loading explore feed</div>';
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

    loadExploreFeed();
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
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <a href="/home" class="logo">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
      </a>
      
      <a href="/home" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Explore</span>
      </a>
      <a href="/notifications" class="nav-item active">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
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

      <div class="tabs">
        <button class="tab active">All</button>
        <button class="tab">Mentions</button>
      </div>

      <div id="notifications-list">
        <div class="empty-state">Loading notifications...</div>
      </div>
    </div>

    <!-- Right Sidebar -->
    <div class="sidebar-right">
      <div class="search-box">
        <input type="text" class="search-input" placeholder="Search">
      </div>
    </div>
  </div>

  <script src="/js/api.js"></script>
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
        const response = await notifications.getNotifications();
        
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
              default:
                iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
                notifText = notif.actorDisplayName + ' interacted with your content';
            }
            
            const avatarHtml = notif.actorAvatarUrl 
              ? '<img src="' + notif.actorAvatarUrl + '" class="avatar avatar-sm" alt="' + notif.actorDisplayName + '">'
              : '<div class="avatar avatar-sm" style="background: #1D9BF0;"></div>';
            
            return '<div class="post-card" style="cursor: default;">' +
              '<div style="display: flex; gap: 12px;">' +
                '<div style="width: 32px; flex-shrink: 0;">' + iconSvg + '</div>' +
                '<div style="flex: 1;">' +
                  '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">' +
                    avatarHtml +
                    '<strong>' + escapeHtml(notifText) + '</strong>' +
                  '</div>' +
                  '<div style="color: var(--muted-foreground); font-size: 13px;">' + timeStr + '</div>' +
                  (notif.postContent ? '<div style="margin-top: 8px; color: var(--muted-foreground); font-size: 14px;">' + escapeHtml(notif.postContent) + '</div>' : '') +
                '</div>' +
              '</div>' +
            '</div>';
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
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <div class="logo">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path></svg>
      </div>
      
      <a href="/home" class="nav-item">
        <span class="nav-icon">🏠</span>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item">
        <span class="nav-icon">🔍</span>
        <span>Explore</span>
      </a>
      <a href="/notifications" class="nav-item">
        <span class="nav-icon">🔔</span>
        <span>Notifications</span>
      </a>
      <a href="/u/me" class="nav-item">
        <span class="nav-icon">👤</span>
        <span>Profile</span>
      </a>
      <a href="/settings" class="nav-item">
        <span class="nav-icon">⚙️</span>
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
        <div class="compose-box">
          <div style="display: flex; gap: 12px;">
            <img id="reply-avatar" class="avatar" src="" alt="Your avatar">
            <div style="flex: 1;">
              <form id="reply-form">
                <textarea 
                  id="reply-content" 
                  placeholder="Post your reply"
                  maxlength="280"
                ></textarea>
                <div class="compose-footer">
                  <div class="compose-actions">
                    <button type="button" class="icon-button">📷</button>
                    <button type="button" class="icon-button">😊</button>
                  </div>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span id="reply-char-counter" class="char-counter">0 / 280</span>
                    <button type="submit" class="tweet-button" id="reply-btn" disabled>Reply</button>
                  </div>
                </div>
              </form>
            </div>
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
        <input type="text" class="search-input" placeholder="Search">
      </div>
    </div>
  </div>

  <script src="/js/api.js"></script>
  <script>
    const postId = '${postId}';
    let currentUser = null;

    async function loadPost() {
      try {
        const response = await posts.get(postId);
        
        if (response.success) {
          const post = response.data;
          const date = new Date(post.createdAt);
          const fullTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' · ' + 
                          date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          
          const avatarHtml = post.authorAvatarUrl
            ? '<img src="' + post.authorAvatarUrl + '" class="avatar" alt="' + post.authorDisplayName + '">'
            : '<div class="avatar" style="background: #1D9BF0;"></div>';
          
          const likedClass = post.hasLiked ? ' liked' : '';
          
          document.getElementById('post-container').innerHTML =
            '<div style="padding: 12px 16px; border-bottom: 1px solid #EFF3F4;">' +
              '<div class="post-header">' +
                '<a href="/u/' + post.authorHandle + '">' + avatarHtml + '</a>' +
                '<div class="post-body">' +
                  '<div class="post-author-row">' +
                    '<a href="/u/' + post.authorHandle + '" class="post-author">' + escapeHtml(post.authorDisplayName) + '</a>' +
                    '<a href="/u/' + post.authorHandle + '" class="post-handle">@' + post.authorHandle + '</a>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="post-content" style="font-size: 23px; line-height: 28px; margin: 12px 0;">' + escapeHtml(post.content) + '</div>' +
              '<div style="color: #536471; font-size: 15px; margin: 12px 0; padding-bottom: 12px; border-bottom: 1px solid #EFF3F4;">' + fullTime + '</div>' +
              '<div class="post-actions" style="border-bottom: 1px solid #EFF3F4; padding: 12px 0;">' +
                '<span class="post-action">💬 <span id="reply-count">' + post.replyCount + '</span></span>' +
                '<span class="post-action">🔁 ' + post.repostCount + '</span>' +
                '<span class="post-action' + likedClass + '" id="like-btn">' +
                  '❤️ <span id="like-count">' + post.likeCount + '</span>' +
                '</span>' +
                '<span class="post-action">📊</span>' +
              '</div>' +
            '</div>';

          if (auth.isAuthenticated()) {
            document.getElementById('like-btn').addEventListener('click', handleLike);
            document.getElementById('reply-composer').style.display = 'block';
            setupReplyComposer();
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
          const profileResp = await users.getProfile(response.data.handle);
          if (profileResp.success) {
            currentUser = profileResp.data;
            
            const replyAvatar = document.getElementById('reply-avatar');
            if (currentUser.avatarUrl) {
              replyAvatar.src = currentUser.avatarUrl;
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

      replyTextarea.addEventListener('input', () => {
        const length = replyTextarea.value.length;
        replyCounter.textContent = length + ' / 280';
        replyBtn.disabled = length === 0;
      });

      replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const content = replyTextarea.value.trim();
        if (!content) return;

        replyError.textContent = '';
        replySuccess.textContent = '';
        replyBtn.disabled = true;
        replyBtn.textContent = 'Replying...';

        try {
          const response = await posts.create(content, [], postId, null);
          
          if (response.success) {
            replySuccess.textContent = 'Reply posted!';
            replyTextarea.value = '';
            replyCounter.textContent = '0 / 280';
            
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
              ? '<img src="' + reply.authorAvatarUrl + '" class="avatar" alt="' + reply.authorDisplayName + '">'
              : '<div class="avatar" style="background: #1D9BF0;"></div>';
            
            const likedClass = reply.hasLiked ? ' liked' : '';
            
            return '<div class="post-card" onclick="window.location.href=\\'/post/' + reply.id + '\\'">' +
              '<div class="post-header">' +
                '<a href="/u/' + reply.authorHandle + '" onclick="event.stopPropagation()">' + avatarHtml + '</a>' +
                '<div class="post-body">' +
                  '<div class="post-author-row">' +
                    '<a href="/u/' + reply.authorHandle + '" class="post-author" onclick="event.stopPropagation()">' + escapeHtml(reply.authorDisplayName) + '</a>' +
                    '<a href="/u/' + reply.authorHandle + '" class="post-handle" onclick="event.stopPropagation()">@' + reply.authorHandle + '</a>' +
                    '<span class="post-timestamp">' + timeStr + '</span>' +
                  '</div>' +
                  '<div class="post-content">' + escapeHtml(reply.content) + '</div>' +
                  '<div class="post-actions" onclick="event.stopPropagation()">' +
                    '<span class="post-action">💬 ' + reply.replyCount + '</span>' +
                    '<span class="post-action">🔁 ' + reply.repostCount + '</span>' +
                    '<span class="post-action' + likedClass + '">❤️ ' + reply.likeCount + '</span>' +
                    '<span class="post-action">📊</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('');
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

    loadPost();
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
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <a href="/home" class="logo">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
      </a>
      
      <a href="/home" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Explore</span>
      </a>
      <a href="/notifications" class="nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
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

        <!-- Avatar Upload -->
        <div class="settings-section">
          <h3>Avatar</h3>
          <div id="current-avatar" class="avatar avatar-lg" style="margin-bottom: 1rem;"></div>
          <input type="file" id="avatar-file" accept="image/*" style="margin-bottom: 1rem;">
          <button class="btn-secondary" id="upload-avatar-btn">Upload Avatar</button>
          <div id="avatar-success" class="success"></div>
          <div id="avatar-error" class="error"></div>
        </div>

        <!-- Banner Upload -->
        <div class="settings-section">
          <h3>Banner</h3>
          <div id="current-banner" class="profile-banner" style="margin-bottom: 1rem;"></div>
          <input type="file" id="banner-file" accept="image/*" style="margin-bottom: 1rem;">
          <button class="btn-secondary" id="upload-banner-btn">Upload Banner</button>
          <div id="banner-success" class="success"></div>
          <div id="banner-error" class="error"></div>
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
        <input type="text" class="search-input" placeholder="Search">
      </div>
    </div>
  </div>

  <script src="/js/api.js"></script>
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
            
            if (currentUser.avatarUrl) {
              document.getElementById('current-avatar').style.backgroundImage = 
                'url(' + currentUser.avatarUrl + '?width=128&quality=80)';
              document.getElementById('current-avatar').style.backgroundSize = 'cover';
            }
            
            if (currentUser.bannerUrl) {
              document.getElementById('current-banner').style.backgroundImage = 
                'url(' + currentUser.bannerUrl + '?width=800&quality=85)';
              document.getElementById('current-banner').style.backgroundSize = 'cover';
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

    document.getElementById('upload-avatar-btn').addEventListener('click', async () => {
      const file = document.getElementById('avatar-file').files[0];
      if (!file) {
        alert('Please select an image');
        return;
      }
      
      const successMsg = document.getElementById('avatar-success');
      const errorMsg = document.getElementById('avatar-error');
      
      try {
        await media.uploadAvatar(file);
        successMsg.textContent = 'Avatar uploaded!';
        setTimeout(() => {
          loadProfile();
          successMsg.textContent = '';
        }, 1000);
      } catch (error) {
        errorMsg.textContent = error.message;
      }
    });

    document.getElementById('upload-banner-btn').addEventListener('click', async () => {
      const file = document.getElementById('banner-file').files[0];
      if (!file) {
        alert('Please select an image');
        return;
      }
      
      const successMsg = document.getElementById('banner-success');
      const errorMsg = document.getElementById('banner-error');
      
      try {
        await media.uploadBanner(file);
        successMsg.textContent = 'Banner uploaded!';
        setTimeout(() => {
          loadProfile();
          successMsg.textContent = '';
        }, 1000);
      } catch (error) {
        errorMsg.textContent = error.message;
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
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <div class="logo">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path></svg>
      </div>
      
      <a href="/home" class="nav-item">
        <span class="nav-icon">🏠</span>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item">
        <span class="nav-icon">🔍</span>
        <span>Explore</span>
      </a>
      <a href="/notifications" class="nav-item">
        <span class="nav-icon">🔔</span>
        <span>Notifications</span>
      </a>
      <a href="/u/me" class="nav-item active">
        <span class="nav-icon">👤</span>
        <span>Profile</span>
      </a>
      <a href="/settings" class="nav-item">
        <span class="nav-icon">⚙️</span>
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
        <input type="text" class="search-input" placeholder="Search">
      </div>
    </div>
  </div>

  <script src="/js/api.js"></script>
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
        ? '<img src="' + profileUser.bannerUrl + '" class="profile-banner" alt="Banner">'
        : '<div class="profile-banner"></div>';

      const avatarHtml = profileUser.avatarUrl
        ? '<img src="' + profileUser.avatarUrl + '" class="avatar avatar-lg" alt="' + profileUser.displayName + '">'
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
              '<span class="profile-stat"><strong>' + profileUser.followingCount + '</strong> Following</span>' +
              '<span class="profile-stat"><strong>' + profileUser.followerCount + '</strong> Followers</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tabs">' +
          '<button class="tab active">Posts</button>' +
          '<button class="tab">Replies</button>' +
          '<button class="tab">Media</button>' +
          '<button class="tab">Likes</button>' +
        '</div>' +
        '<div id="user-posts"></div>';

      if (!isOwnProfile && auth.isAuthenticated()) {
        setupFollowButton();
      }
      
      loadUserPosts();
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function loadUserPosts() {
      try {
        const response = await fetch('/api/users/' + handle + '/posts?limit=20');
        const data = await response.json();
        
        const postsContainer = document.getElementById('user-posts');
        
        if (data.success && data.data.posts.length > 0) {
          postsContainer.innerHTML = data.data.posts.map(post => {
            const date = new Date(post.createdAt);
            const timeStr = formatTimeAgo(date);
            
            return '<div class="post-card" onclick="window.location.href=\\'/post/' + post.id + '\\'">' +
              '<div class="post-header">' +
                '<div class="post-body">' +
                  '<div class="post-author-row">' +
                    '<span class="post-timestamp">' + timeStr + '</span>' +
                  '</div>' +
                  '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
                  '<div class="post-actions" onclick="event.stopPropagation()">' +
                    '<span class="post-action">💬 ' + post.replyCount + '</span>' +
                    '<span class="post-action">🔁 ' + post.repostCount + '</span>' +
                    '<span class="post-action">❤️ ' + post.likeCount + '</span>' +
                    '<span class="post-action">📊</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('');
        } else {
          postsContainer.innerHTML = '<div class="empty-state">No posts yet</div>';
        }
      } catch (error) {
        console.error('Error loading user posts:', error);
      }
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

    loadProfile();
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

// Mount media routes
app.route('/api/media', mediaRoutes);

// Mount moderation routes (admin only)
app.route('/api/moderation', moderationRoutes);

// Mount notifications routes
app.route('/api/notifications', notificationsRoutes);

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
  transition: background-color 0.3s ease, color 0.3s ease;
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

.post-author-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 2px;
  flex-wrap: wrap;
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
  async getNotifications(cursor, limit = 20) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.append('cursor', cursor);
    return await apiRequest('/notifications?' + params.toString());
  },

  async getUnreadCount() {
    return await apiRequest('/notifications/unread-count');
  },

  async markRead(notificationId) {
    return await apiRequest('/notifications/' + notificationId + '/read', {
      method: 'PUT',
    });
  },

  async markAllRead() {
    return await apiRequest('/notifications/read-all', {
      method: 'PUT',
    });
  },
};

const theme = {
  current: 'twitter',
  
  init() {
    const saved = localStorage.getItem('the_wire_theme');
    if (saved) {
      this.apply(saved);
    } else {
      this.apply('twitter');
    }
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
      console.log('WebSocket connected');
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
      console.log('WebSocket disconnected');
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
};`;
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
  <link rel="stylesheet" href="/css/styles.css">
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

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ success: false, error: 'Internal server error' }, 500);
});

// Export Durable Objects
export { UserDO } from './durable-objects/UserDO';
export { PostDO } from './durable-objects/PostDO';
export { FeedDO } from './durable-objects/FeedDO';
export { WebSocketDO } from './durable-objects/WebSocketDO';

// Export for Cloudflare Workers
export default app;

// Scheduled handler for cron triggers
export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  await handleScheduled(event, env, ctx);
}

// Queue consumer for fan-out processing
export async function queue(
  batch: MessageBatch<import('./types/feed').FanOutMessage>,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const msg = message.body;

      if (msg.type === 'new_post') {
        // Add to author's own feed
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

        // Get post metadata once for broadcasts
        const postData = await env.POSTS_KV.get(`post:${msg.postId}`);
        const postMetadata = postData ? JSON.parse(postData) : null;

        // Add to each follower's feed
        for (const followerId of followersData.followers) {
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
            const wsDoId = env.WEBSOCKET_DO.idFromName(followerId);
            const wsStub = env.WEBSOCKET_DO.get(wsDoId);
            
            await wsStub.fetch('https://do.internal/broadcast-post', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ post: postMetadata }),
            });
          }
        }
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

        for (const followerId of followersData.followers) {
          const feedId = env.FEED_DO.idFromName(followerId);
          const feedStub = env.FEED_DO.get(feedId);
          
          await feedStub.fetch('https://do.internal/remove-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: msg.postId }),
          });
        }
      }

      message.ack();
    } catch (error) {
      console.error('Error processing queue message:', error);
      const backoff = Math.min(3600, 30 ** message.attempts);
      message.retry({ delaySeconds: backoff });
    }
  }
}