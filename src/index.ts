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
  <title>The Wire</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 4rem;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #00d9ff 0%, #0077ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tagline {
      font-size: 1.5rem;
      color: #a0a0a0;
      margin-bottom: 2rem;
    }
    .cta {
      display: inline-block;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #00d9ff 0%, #0077ff 100%);
      color: #fff;
      text-decoration: none;
      border-radius: 50px;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0, 217, 255, 0.3);
    }
    .features {
      margin-top: 3rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      max-width: 800px;
    }
    .feature {
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .feature h3 {
      margin-bottom: 0.5rem;
      color: #00d9ff;
    }
    .feature p {
      font-size: 0.9rem;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>The Wire</h1>
    <p class="tagline">Share your notes with the world. Lightning fast.</p>
    <a href="/signup" class="cta">Get Started</a>
    <div class="features">
      <div class="feature">
        <h3>⚡ Edge-Native</h3>
        <p>Powered by Cloudflare's global network for sub-50ms latency</p>
      </div>
      <div class="feature">
        <h3>📝 Notes</h3>
        <p>Share thoughts in 280 characters or less</p>
      </div>
      <div class="feature">
        <h3>🌐 Global</h3>
        <p>Distributed infrastructure across 300+ locations</p>
      </div>
    </div>
  </div>
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
</head>
<body>
  <div class="auth-container">
    <h1 class="text-center">Join The Wire</h1>
    <p class="text-center text-muted" style="margin-bottom: 1rem;">
      Create your account to start sharing notes
    </p>

    <form id="signup-form">
      <div class="form-group">
        <label for="handle">Handle</label>
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
        <small class="text-muted">3-15 characters, letters, numbers, and underscores</small>
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
        <small class="text-muted">At least 8 characters with uppercase, lowercase, and number</small>
      </div>

      <div id="error-message" class="error"></div>
      <div id="success-message" class="success"></div>

      <button type="submit" id="submit-btn">Create Account</button>
    </form>

    <p class="text-center mt-1">
      Already have an account? 
      <a href="/login" class="link">Log in</a>
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
        submitBtn.textContent = 'Create Account';
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
</head>
<body>
  <div class="auth-container">
    <h1 class="text-center">Welcome Back</h1>
    <p class="text-center text-muted" style="margin-bottom: 1rem;">
      Log in to The Wire
    </p>

    <form id="login-form">
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

      <button type="submit" id="submit-btn">Log In</button>
    </form>

    <p class="text-center mt-1">
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
      submitBtn.textContent = 'Logging in...';

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
        submitBtn.textContent = 'Log In';
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
</head>
<body>
  <div class="twitter-layout">
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <div class="logo">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path></svg>
      </div>
      
      <a href="/home" class="nav-item active">
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
      <a href="/u/${c.get('userHandle') || 'me'}" class="nav-item">
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
                  <button type="button" class="icon-button">📷</button>
                  <button type="button" class="icon-button">😊</button>
                  <button type="button" class="icon-button">📊</button>
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
</head>
<body>
  <div class="container">
    <div class="nav-bar">
      <h1 style="margin: 0;">The Wire</h1>
      <div class="nav-links">
        <button onclick="window.location.href='/home'">Home</button>
        <button id="logout-btn">Log Out</button>
      </div>
    </div>

    <h2>Settings</h2>
    
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

        <button type="submit" id="save-profile-btn">Save Profile</button>
      </form>
      <div id="profile-success" class="success"></div>
      <div id="profile-error" class="error"></div>
    </div>

    <div class="settings-section">
      <h3>Avatar</h3>
      <div id="current-avatar" class="avatar avatar-lg" style="margin-bottom: 1rem;"></div>
      <input type="file" id="avatar-file" accept="image/*" style="margin-bottom: 1rem;">
      <button id="upload-avatar-btn">Upload Avatar</button>
      <div id="avatar-success" class="success"></div>
      <div id="avatar-error" class="error"></div>
    </div>

    <div class="settings-section">
      <h3>Banner</h3>
      <div id="current-banner" class="banner" style="margin-bottom: 1rem;"></div>
      <input type="file" id="banner-file" accept="image/*" style="margin-bottom: 1rem;">
      <button id="upload-banner-btn">Upload Banner</button>
      <div id="banner-success" class="success"></div>
      <div id="banner-error" class="error"></div>
    </div>
  </div>

  <script src="/js/api.js"></script>
  <script>
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }

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

// Serve CSS
app.get('/css/styles.css', async (_c) => {
  const css = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --twitter-blue: #1D9BF0;
  --twitter-blue-hover: #1A8CD8;
  --twitter-black: #0F1419;
  --twitter-dark-gray: #536471;
  --twitter-light-gray: #EFF3F4;
  --twitter-bg: #FFFFFF;
  --twitter-hover-bg: #F7F9F9;
  --twitter-border: #EFF3F4;
  --twitter-red: #F4212E;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: var(--twitter-bg);
  color: var(--twitter-black);
  font-size: 15px;
  line-height: 20px;
}

/* Main layout - 3 columns */
.twitter-layout {
  display: flex;
  max-width: 1265px;
  margin: 0 auto;
  min-height: 100vh;
}

/* Left sidebar - Navigation */
.sidebar-left {
  width: 275px;
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}

.logo {
  padding: 12px;
  margin-bottom: 4px;
}

.logo svg {
  width: 30px;
  height: 30px;
  fill: var(--twitter-black);
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 9999px;
  text-decoration: none;
  color: var(--twitter-black);
  font-size: 20px;
  font-weight: 400;
  margin-bottom: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.nav-item:hover {
  background: var(--twitter-hover-bg);
}

.nav-item.active {
  font-weight: 700;
}

.nav-icon {
  width: 26px;
  height: 26px;
  margin-right: 20px;
  font-size: 26px;
}

.post-button {
  background: var(--twitter-blue);
  color: white;
  border: none;
  border-radius: 9999px;
  padding: 16px;
  font-size: 17px;
  font-weight: 700;
  width: 90%;
  margin: 16px auto;
  cursor: pointer;
  transition: background-color 0.2s;
}

.post-button:hover {
  background: var(--twitter-blue-hover);
}

/* Center column - Main content */
.main-content {
  width: 600px;
  border-left: 1px solid var(--twitter-border);
  border-right: 1px solid var(--twitter-border);
  min-height: 100vh;
}

/* Right sidebar */
.sidebar-right {
  width: 350px;
  padding: 0 16px;
}

.search-box {
  position: sticky;
  top: 0;
  background: var(--twitter-bg);
  padding: 4px 0 16px;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 48px;
  border-radius: 9999px;
  border: none;
  background: var(--twitter-light-gray);
  font-size: 15px;
}

.search-input:focus {
  outline: 1px solid var(--twitter-blue);
  background: white;
}

/* Header */
.page-header {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--twitter-border);
  padding: 0 16px;
  height: 53px;
  display: flex;
  align-items: center;
  z-index: 2;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--twitter-black);
}

/* Tabs */
.tabs {
  display: flex;
  border-bottom: 1px solid var(--twitter-border);
}

.tab {
  flex: 1;
  padding: 16px;
  text-align: center;
  font-weight: 500;
  color: var(--twitter-dark-gray);
  cursor: pointer;
  position: relative;
  border: none;
  background: transparent;
  font-size: 15px;
}

.tab:hover {
  background: var(--twitter-hover-bg);
}

.tab.active {
  font-weight: 700;
  color: var(--twitter-black);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 4px;
  background: var(--twitter-blue);
  border-radius: 2px;
}

/* Compose box */
.compose-box {
  border-bottom: 1px solid var(--twitter-border);
  padding: 12px 16px 16px;
}

.compose-box textarea {
  width: 100%;
  border: none;
  font-size: 20px;
  font-family: inherit;
  resize: none;
  min-height: 120px;
  margin-top: 8px;
  color: var(--twitter-black);
}

.compose-box textarea::placeholder {
  color: var(--twitter-dark-gray);
}

.compose-box textarea:focus {
  outline: none;
}

.compose-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--twitter-border);
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
  color: var(--twitter-blue);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.icon-button:hover {
  background: rgba(29, 155, 240, 0.1);
}

.tweet-button {
  background: var(--twitter-blue);
  color: white;
  border: none;
  border-radius: 9999px;
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 700;
  min-width: 80px;
  cursor: pointer;
}

.tweet-button:hover:not(:disabled) {
  background: var(--twitter-blue-hover);
}

.tweet-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Post card */
.post-card {
  border-bottom: 1px solid var(--twitter-border);
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.post-card:hover {
  background: var(--twitter-hover-bg);
}

.post-header {
  display: flex;
  gap: 12px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.avatar-sm {
  width: 32px;
  height: 32px;
}

.avatar-lg {
  width: 128px;
  height: 128px;
  border: 4px solid white;
  margin-top: -15%;
  position: relative;
}

.post-body {
  flex: 1;
  min-width: 0;
}

.post-author-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 2px;
}

.post-author {
  font-weight: 700;
  color: var(--twitter-black);
  font-size: 15px;
}

.post-author:hover {
  text-decoration: underline;
}

.post-handle {
  color: var(--twitter-dark-gray);
  font-size: 15px;
}

.post-handle:hover {
  text-decoration: underline;
}

.post-timestamp {
  color: var(--twitter-dark-gray);
  font-size: 15px;
}

.post-timestamp::before {
  content: '·';
  margin: 0 4px;
}

.post-content {
  font-size: 15px;
  line-height: 20px;
  color: var(--twitter-black);
  margin-top: 2px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.post-actions {
  display: flex;
  justify-content: space-between;
  max-width: 425px;
  margin-top: 12px;
}

.post-action {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--twitter-dark-gray);
  font-size: 13px;
  padding: 8px;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s;
}

.post-action:hover {
  background: rgba(29, 155, 240, 0.1);
  color: var(--twitter-blue);
}

.post-action.liked {
  color: #F91880;
}

.post-action.liked:hover {
  background: rgba(249, 24, 128, 0.1);
}

/* Profile */
.profile-header {
  position: relative;
}

.profile-banner {
  width: 100%;
  height: 200px;
  background: var(--twitter-light-gray);
  object-fit: cover;
}

.profile-info {
  padding: 12px 16px;
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
  color: var(--twitter-black);
}

.profile-handle {
  font-size: 15px;
  color: var(--twitter-dark-gray);
  margin-bottom: 12px;
}

.profile-bio {
  font-size: 15px;
  line-height: 20px;
  margin-bottom: 12px;
}

.profile-meta {
  display: flex;
  gap: 12px;
  color: var(--twitter-dark-gray);
  font-size: 15px;
  margin-bottom: 12px;
}

.profile-stats {
  display: flex;
  gap: 20px;
  font-size: 15px;
}

.profile-stat {
  color: var(--twitter-dark-gray);
}

.profile-stat strong {
  color: var(--twitter-black);
  font-weight: 700;
}

.profile-stat:hover {
  text-decoration: underline;
  cursor: pointer;
}

/* Buttons */
.btn-primary {
  background: var(--twitter-black);
  color: white;
  border: none;
  border-radius: 9999px;
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  min-width: 100px;
}

.btn-primary:hover {
  background: #272C30;
}

.btn-secondary {
  background: transparent;
  color: var(--twitter-black);
  border: 1px solid var(--twitter-border);
  border-radius: 9999px;
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  min-width: 100px;
}

.btn-secondary:hover {
  background: var(--twitter-hover-bg);
}

/* Widget boxes (right sidebar) */
.widget-box {
  background: var(--twitter-light-gray);
  border-radius: 16px;
  margin-bottom: 16px;
  overflow: hidden;
}

.widget-header {
  padding: 12px 16px;
  font-size: 20px;
  font-weight: 800;
  color: var(--twitter-black);
}

.widget-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.widget-item:hover {
  background: var(--twitter-hover-bg);
}

.widget-item-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--twitter-black);
  margin-bottom: 2px;
}

.widget-item-meta {
  font-size: 13px;
  color: var(--twitter-dark-gray);
}

/* Auth pages */
.auth-container {
  max-width: 600px;
  margin: 48px auto;
  padding: 48px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--twitter-dark-gray);
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--twitter-border);
  border-radius: 4px;
  font-size: 17px;
  color: var(--twitter-black);
}

.form-group input:focus {
  outline: none;
  border-color: var(--twitter-blue);
}

.error {
  color: var(--twitter-red);
  font-size: 13px;
  margin-top: 8px;
}

.success {
  color: #00BA7C;
  font-size: 13px;
  margin-top: 8px;
}

.text-center {
  text-align: center;
}

.link {
  color: var(--twitter-blue);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

/* Empty state */
.empty-state {
  padding: 32px;
  text-align: center;
  color: var(--twitter-dark-gray);
}

/* Utilities */
.mt-1 { margin-top: 8px; }
.mb-1 { margin-bottom: 8px; }
.text-muted { color: var(--twitter-dark-gray); }

small {
  font-size: 13px;
  color: var(--twitter-dark-gray);
  display: block;
  margin-top: 4px;
}

/* Char counter */
.char-counter {
  font-size: 13px;
  color: var(--twitter-dark-gray);
}

.char-counter.warning {
  color: #FFD400;
}

.char-counter.error {
  color: var(--twitter-red);
}`;
  return new Response(css, {
    headers: { 'Content-Type': 'text/css' },
  });
});

// Serve API client JavaScript
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

// WebSocket manager for real-time updates
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
      
      // Start heartbeat
      this.heartbeatInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Ping every 30 seconds
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Emit event to listeners
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
      
      // Auto-reconnect with exponential backoff
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