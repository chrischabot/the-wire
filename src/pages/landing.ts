export function getLandingPage(): string {
  return `
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
