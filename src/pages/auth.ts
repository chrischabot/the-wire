export function getSignupPage(): string {
  return `
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

export function getLoginPage(): string {
  return `
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
