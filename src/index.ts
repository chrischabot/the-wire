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
  <title>Home - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="container">
    <div class="nav-bar">
      <h1 style="margin: 0;">The Wire</h1>
      <button id="logout-btn">Log Out</button>
    </div>

    <div class="compose-box">
      <h2>What's on your mind?</h2>
      <div style="display: flex; gap: 1rem; align-items: start;">
        <img id="compose-avatar" class="avatar" src="" alt="Your avatar" style="display: none;">
        <div style="flex: 1;">
          <form id="compose-form">
            <textarea 
              id="note-content" 
              placeholder="Share a note..."
              maxlength="280"
            ></textarea>
            <div class="compose-footer">
              <span id="char-counter" class="char-counter">0 / 280</span>
              <button type="submit" id="post-btn" disabled>Post Note</button>
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
              composeAvatar.src = currentUser.avatarUrl + '?width=48&quality=80';
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
        charCounter.className = 'char-counter';
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
          composeSuccess.textContent = 'Note posted!';
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
        postBtn.textContent = 'Post Note';
      }
    });

    function renderTimeline(posts) {
      if (!posts || posts.length === 0) {
        timeline.innerHTML = '<div class="empty-state">No notes yet. Follow users to see their posts!</div>';
        return;
      }

      timeline.innerHTML = posts.map(post => {
        const date = new Date(post.createdAt);
        const timeStr = date.toLocaleTimeString() + ' · ' + date.toLocaleDateString();
        
        const avatarHtml = post.authorAvatarUrl 
          ? '<img src="' + post.authorAvatarUrl + '?width=48&quality=80" class="avatar" alt="' + post.authorDisplayName + '">'
          : '<div class="avatar" style="background: linear-gradient(135deg, #00d9ff, #0077ff);"></div>';
        
        const likedClass = post.hasLiked ? ' liked' : '';
        
        return '<div class="post-card" data-post-id="' + post.id + '">' +
          '<div class="post-header">' +
            avatarHtml +
            '<div style="flex: 1; margin-left: 0.75rem;">' +
              '<div>' +
                '<a href="/u/' + post.authorHandle + '" class="post-author-link">' +
                  '<span class="post-author">' + post.authorDisplayName + '</span>' +
                '</a> ' +
                '<a href="/u/' + post.authorHandle + '" class="post-handle-link">' +
                  '<span class="post-handle">@' + post.authorHandle + '</span>' +
                '</a>' +
              '</div>' +
              '<span class="post-timestamp">' + timeStr + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
          '<div class="post-actions">' +
            '<span class="post-action' + likedClass + '" data-action="like" data-post-id="' + post.id + '">' +
              '❤️ <span class="like-count">' + post.likeCount + '</span>' +
            '</span>' +
            '<span class="post-action">' +
              '💬 ' + post.replyCount +
            '</span>' +
          '</div>' +
        '</div>';
      }).join('');

      document.querySelectorAll('[data-action="like"]').forEach(btn => {
        btn.addEventListener('click', handleLike);
      });
    }

    async function handleLike(e) {
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

    document.getElementById('logout-btn').addEventListener('click', async () => {
      try {
        await auth.logout();
        window.location.href = '/';
      } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
      }
    });

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
  <title>Post - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="container">
    <div class="nav-bar">
      <h1 style="margin: 0;">The Wire</h1>
      <button onclick="window.location.href='/home'">Back to Home</button>
    </div>

    <div id="post-container">
      <div class="empty-state">Loading post...</div>
    </div>
  </div>

  <script src="/js/api.js"></script>
  <script>
    const postId = '${postId}';

    async function loadPost() {
      try {
        const response = await posts.get(postId);
        
        if (response.success) {
          const post = response.data;
          const date = new Date(post.createdAt);
          const timeStr = date.toLocaleTimeString() + ' · ' + date.toLocaleDateString();
          
          const avatarHtml = post.authorAvatarUrl
            ? '<img src="' + post.authorAvatarUrl + '?width=64&quality=80" class="avatar avatar-lg" alt="' + post.authorDisplayName + '">'
            : '<div class="avatar avatar-lg" style="background: linear-gradient(135deg, #00d9ff, #0077ff);"></div>';
          
          document.getElementById('post-container').innerHTML =
            '<div class="post-card">' +
              '<div class="post-header">' +
                avatarHtml +
                '<div style="flex: 1; margin-left: 0.75rem;">' +
                  '<div>' +
                    '<a href="/u/' + post.authorHandle + '" class="post-author-link">' +
                      '<span class="post-author">' + post.authorDisplayName + '</span>' +
                    '</a> ' +
                    '<a href="/u/' + post.authorHandle + '" class="post-handle-link">' +
                      '<span class="post-handle">@' + post.authorHandle + '</span>' +
                    '</a>' +
                  '</div>' +
                  '<span class="post-timestamp">' + timeStr + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="post-content" style="font-size: 1.2rem;">' + escapeHtml(post.content) + '</div>' +
              '<div class="post-actions">' +
                '<span class="post-action ' + (post.hasLiked ? 'liked' : '') + '" id="like-btn">' +
                  '❤️ <span id="like-count">' + post.likeCount + '</span>' +
                '</span>' +
                '<span class="post-action">' +
                  '💬 ' + post.replyCount +
                '</span>' +
              '</div>' +
            '</div>';

          if (auth.isAuthenticated()) {
            document.getElementById('like-btn').addEventListener('click', handleLike);
          }
        }
      } catch (error) {
        document.getElementById('post-container').innerHTML =
          '<div class="error">Error loading post: ' + error.message + '</div>';
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

    loadPost();
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
  <title>@${handle} - The Wire</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="container">
    <div class="nav-bar">
      <h1 style="margin: 0;">The Wire</h1>
      <button onclick="window.location.href='/home'">Home</button>
    </div>

    <div id="profile-container">
      <div class="empty-state">Loading profile...</div>
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
          '<div class="error">Error loading profile: ' + error.message + '</div>';
      }
    }

    function renderProfile() {
      const isOwnProfile = currentUserId === profileUser.id;
      
      let actionButtons = '';
      if (auth.isAuthenticated()) {
        if (isOwnProfile) {
          actionButtons = '<button class="action-btn" onclick="window.location.href=\\'/settings\\'">Edit Profile</button>';
        } else {
          const followBtnText = isFollowing ? 'Following' : 'Follow';
          actionButtons = '<button id="follow-btn" class="action-btn">' + followBtnText + '</button>' +
                         '<button id="block-btn" class="action-btn-secondary">Block</button>';
        }
      }

      const bannerHtml = profileUser.bannerUrl
        ? '<div class="banner" style="background-image: url(' + profileUser.bannerUrl + '?width=800&quality=85); background-size: cover; background-position: center;"></div>'
        : '';

      const avatarHtml = profileUser.avatarUrl
        ? '<img src="' + profileUser.avatarUrl + '?width=128&quality=80" class="avatar avatar-lg clickable" alt="' + profileUser.displayName + '" onclick="viewImage(\\'' + profileUser.avatarUrl + '\\')">'
        : '<div class="avatar avatar-lg" style="background: linear-gradient(135deg, #00d9ff, #0077ff);"></div>';

      document.getElementById('profile-container').innerHTML =
        bannerHtml +
        '<div class="profile-header">' +
          avatarHtml +
          '<div class="profile-info">' +
            '<h2>' + profileUser.displayName + '</h2>' +
            '<p class="text-muted">@' + profileUser.handle + '</p>' +
            '<p>' + (profileUser.bio || '') + '</p>' +
            '<div class="profile-stats">' +
              '<span><strong>' + profileUser.followerCount + '</strong> Followers</span>' +
              '<span><strong>' + profileUser.followingCount + '</strong> Following</span>' +
              '<span><strong>' + profileUser.postCount + '</strong> Posts</span>' +
            '</div>' +
            '<div class="profile-actions">' + actionButtons + '</div>' +
          '</div>' +
        '</div>' +
        '<div id="user-posts">' +
          '<h3>Posts</h3>' +
          '<div class="empty-state">Loading posts...</div>' +
        '</div>';

      if (!isOwnProfile && auth.isAuthenticated()) {
        setupSocialButtons();
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
        
        if (data.success && data.data.posts.length > 0) {
          const postsHtml = data.data.posts.map(post => {
            const date = new Date(post.createdAt);
            const timeStr = date.toLocaleTimeString() + ' · ' + date.toLocaleDateString();
            
            return '<div class="post-card">' +
              '<div class="post-header">' +
                '<span class="post-timestamp">' + timeStr + '</span>' +
              '</div>' +
              '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
              '<div class="post-actions">' +
                '<span class="post-action">❤️ ' + post.likeCount + '</span>' +
                '<span class="post-action">💬 ' + post.replyCount + '</span>' +
              '</div>' +
            '</div>';
          }).join('');
          
          document.getElementById('user-posts').innerHTML = '<h3>Posts</h3>' + postsHtml;
        } else {
          document.getElementById('user-posts').innerHTML = '<h3>Posts</h3><div class="empty-state">No posts yet</div>';
        }
      } catch (error) {
        console.error('Error loading user posts:', error);
        document.getElementById('user-posts').innerHTML = '<h3>Posts</h3><div class="error">Error loading posts</div>';
      }
    }

    function viewImage(url) {
      window.open(url, '_blank');
    }

    function setupSocialButtons() {
      const followBtn = document.getElementById('follow-btn');
      const blockBtn = document.getElementById('block-btn');

      if (followBtn) {
        followBtn.addEventListener('click', async () => {
          try {
            if (isFollowing) {
              await social.unfollow(handle);
              followBtn.textContent = 'Follow';
              isFollowing = false;
              profileUser.followerCount--;
            } else {
              await social.follow(handle);
              followBtn.textContent = 'Following';
              isFollowing = true;
              profileUser.followerCount++;
            }
            renderProfile();
          } catch (error) {
            alert('Error: ' + error.message);
          }
        });
      }

      if (blockBtn) {
        blockBtn.addEventListener('click', async () => {
          if (confirm('Block @' + handle + '?')) {
            try {
              await social.block(handle);
              alert('User blocked');
              window.location.href = '/home';
            } catch (error) {
              alert('Error: ' + error.message);
            }
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
      },
    },
  });
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
  --primary: #00d9ff;
  --primary-dark: #0077ff;
  --bg-dark: #1a1a2e;
  --bg-darker: #16213e;
  --text-light: #fff;
  --text-muted: #a0a0a0;
  --error: #ff4444;
  --success: #44ff44;
  --input-bg: rgba(255, 255, 255, 0.05);
  --border: rgba(255, 255, 255, 0.1);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, var(--bg-dark) 0%, var(--bg-darker) 100%);
  min-height: 100vh;
  color: var(--text-light);
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.auth-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px solid var(--border);
}

h1, h2 {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

input[type="email"],
input[type="password"],
input[type="text"],
input[type="url"] {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-light);
  font-size: 1rem;
  transition: border-color 0.2s;
}

input:focus {
  outline: none;
  border-color: var(--primary);
}

button {
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: var(--text-light);
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 217, 255, 0.3);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.error {
  color: var(--error);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.success {
  color: var(--success);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.link {
  color: var(--primary);
  text-decoration: none;
  transition: opacity 0.2s;
}

.link:hover {
  opacity: 0.8;
}

.text-center {
  text-align: center;
}

.text-muted {
  color: var(--text-muted);
}

.mt-1 { margin-top: 1rem; }
.mb-1 { margin-bottom: 1rem; }

small {
  font-size: 0.85rem;
  color: var(--text-muted);
  display: block;
  margin-top: 0.25rem;
}

.compose-box {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.compose-box textarea {
  width: 100%;
  min-height: 120px;
  padding: 1rem;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-light);
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
}

.compose-box textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.compose-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
}

.char-counter {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.char-counter.warning {
  color: #ff9800;
}

.char-counter.error {
  color: var(--error);
}

.compose-footer button {
  width: auto;
  padding: 0.75rem 2rem;
}

.post-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  transition: background 0.2s;
}

.post-card:hover {
  background: rgba(255, 255, 255, 0.04);
}

.post-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}

.post-author {
  font-weight: 600;
  color: var(--text-light);
  margin-right: 0.5rem;
}

.post-handle {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.post-timestamp {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.post-content {
  color: var(--text-light);
  line-height: 1.5;
  margin-bottom: 1rem;
  word-wrap: break-word;
}

.post-actions {
  display: flex;
  gap: 2rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.post-action {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: color 0.2s;
}

.post-action:hover {
  color: var(--primary);
}

.post-action.liked {
  color: #ff4444;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 3rem;
}

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.nav-bar button {
  width: auto;
  padding: 0.5rem 1.5rem;
  font-size: 0.9rem;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border);
  background: var(--input-bg);
}

.avatar-sm {
  width: 32px;
  height: 32px;
}

.avatar-lg {
  width: 128px;
  height: 128px;
}

.profile-header {
  display: flex;
  gap: 1.5rem;
  align-items: start;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 2rem;
}

.profile-info {
  flex: 1;
}

.profile-info h2 {
  margin-bottom: 0.25rem;
}

.profile-stats {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
  color: var(--text-muted);
}

.profile-stats span {
  font-size: 0.9rem;
}

.profile-stats strong {
  color: var(--text-light);
  font-weight: 600;
}

.profile-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}

.action-btn {
  padding: 0.5rem 1.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: var(--text-light);
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  width: auto;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 217, 255, 0.3);
}

.action-btn-secondary {
  padding: 0.5rem 1.5rem;
  background: transparent;
  color: var(--error);
  border: 1px solid var(--error);
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  width: auto;
}

.action-btn-secondary:hover {
  background: var(--error);
  color: var(--text-light);
}

.post-author-link,
.post-handle-link {
  text-decoration: none;
  color: inherit;
}

.post-author-link:hover .post-author {
  text-decoration: underline;
}

.post-handle-link:hover .post-handle {
  text-decoration: underline;
}

.banner {
  width: 100%;
  height: 200px;
  border-radius: 12px 12px 0 0;
  margin-bottom: -3rem;
}

.clickable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.clickable:hover {
  opacity: 0.9;
}

.nav-links {
  display: flex;
  gap: 0.5rem;
}

.settings-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.settings-section h3 {
  margin-bottom: 1.5rem;
  color: var(--primary);
}

.settings-section textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-light);
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
}

.settings-section textarea:focus {
  outline: none;
  border-color: var(--primary);
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