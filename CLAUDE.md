# The Wire - Style Guide & Component Reference

This document defines the UI patterns, reusable components, and best practices for maintaining consistency across The Wire application.

## Design System Overview

The Wire uses a **shadcn/ui-inspired design system** with CSS custom properties for theming, consistent component patterns, and TypeScript-based shared renderers.

### Architecture

| Layer            | Location                                          | Purpose                               |
| ---------------- | ------------------------------------------------- | ------------------------------------- |
| CSS Variables    | `public/css/styles.css`, inline in `src/index.ts` | Theming, colors, spacing              |
| Base Components  | `public/css/styles.css`                           | Reusable CSS classes                  |
| Shared Renderers | `src/shared/*.ts`                                 | TypeScript component generation       |
| Client JS        | `public/js/*.js`                                  | API client, form handling, validation |

---

## CSS Variables & Theming

### Color Palette

All colors use CSS custom properties for theme support:

```css
:root {
  /* Primary colors */
  --primary: #4299e1;
  --primary-foreground: #ffffff;
  --primary-rgb: 66, 153, 225; /* For rgba() usage */

  /* Secondary/neutral */
  --secondary: #edf2f7;
  --secondary-foreground: #2d3748;

  /* Semantic colors */
  --destructive: #f56565;
  --destructive-foreground: #ffffff;
  --success: #48bb78;

  /* Surface colors */
  --background: #fefefe;
  --foreground: #2d3748;
  --muted: #f7fafc;
  --muted-foreground: #718096;
  --border: #e2e8f0;
  --hover: #f7fafc;
  --accent: #bee3f8;
  --accent-foreground: #2c5282;
  --card: #fefefe;
  --card-hover: #f7fafc;
}
```

### Spacing & Radius

```css
:root {
  --radius: 16px; /* Default border radius */
  --radius-sm: 12px; /* Small elements */
  --radius-lg: 24px; /* Large elements, buttons */
  --transition: all 0.2s ease;
}
```

### Available Themes

Set via `data-theme` attribute on root element:

| Theme     | Character                | Primary Color |
| --------- | ------------------------ | ------------- |
| `twitter` | Classic Twitter blue     | `#1d9bf0`     |
| `vega`    | Purple vibes             | `#8b5cf6`     |
| `nova`    | Orange energy, compact   | `#f97316`     |
| `maia`    | Soft & rounded (default) | `#4299e1`     |
| `lyra`    | Green nature             | `#10b981`     |
| `mira`    | Pink dream               | `#ec4899`     |

Theme-specific overrides use attribute selectors:

```css
[data-theme="nova"] .post-button {
  padding: 10px;
  font-size: 15px;
}
```

---

## Button Components

### Base Button Pattern

All buttons extend `.btn-base`:

```css
.btn-base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}
```

### Button Variants

| Class            | Usage               | Style                      |
| ---------------- | ------------------- | -------------------------- |
| `.btn-primary`   | Primary actions     | Solid primary color        |
| `.btn-secondary` | Secondary actions   | Muted background           |
| `.btn-outline`   | Tertiary actions    | Transparent with border    |
| `.btn-ghost`     | Subtle actions      | Transparent, hover reveals |
| `.btn-danger`    | Destructive actions | Red/destructive color      |

### Button Sizes

| Class     | Padding          | Font Size  |
| --------- | ---------------- | ---------- |
| `.btn-sm` | `0.25rem 0.5rem` | `0.75rem`  |
| (default) | `0.5rem 1rem`    | `0.875rem` |
| `.btn-lg` | `0.75rem 1.5rem` | `1rem`     |

### Specialized Buttons

#### Post Button (Sidebar CTA)

```html
<button class="post-button">Post</button>
```

- Large, full-width in sidebar
- Uses `--radius-lg` for extra rounding
- Theme-specific padding variations

#### Tweet/Submit Button (Compose)

```html
<button class="tweet-button" id="post-btn" disabled>Post</button>
```

- Medium size for inline use
- Disabled state with `opacity: 0.5`

#### Icon Button (Actions)

```html
<button class="icon-button">
  <svg>...</svg>
</button>
```

- Circular, 36x36px
- Transparent background
- Hover reveals accent color

#### Follow Button

```html
<button class="follow-button">Follow</button>
<button class="follow-button following">Following</button>
```

- Pill-shaped (`border-radius: 9999px`)
- `.following` state shows outline style
- Hover on `.following` shows destructive (unfollow) styling

---

## Card Components

### Base Card Pattern

```css
.card-base {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1rem;
  transition: background-color 0.2s ease;
}

.card-base:hover {
  background: var(--card-hover);
}
```

### Post Card

**HTML Structure:**

```html
<div class="post-card" data-post-id="123">
  <div class="post-header">
    <a href="/u/handle"><img class="avatar" src="..." alt="" /></a>
    <div class="post-body">
      <div class="post-header-top">
        <div class="post-author-row">
          <a class="post-author">Display Name</a>
          <a class="post-handle">@handle</a>
          <span class="post-timestamp">2h</span>
        </div>
        <div class="post-menu-container"><!-- Dropdown --></div>
      </div>
      <div class="post-content">Post text here...</div>
      <!-- Optional: .post-media, .link-card-container, .quoted-post -->
      <div class="post-actions"><!-- Like, repost, reply buttons --></div>
    </div>
  </div>
</div>
```

**Key Classes:**

- `.post-card` - Clickable card container
- `.post-author` - Bold display name
- `.post-handle` - Muted @username
- `.post-timestamp` - Preceded by `·` via CSS
- `.post-content` - Preserves whitespace (`white-space: pre-wrap`)

### User Card

```html
<div class="user-card" onclick="...">
  <img class="user-card-avatar" src="..." alt="" />
  <div class="user-card-content">
    <div class="user-card-header">
      <span class="user-card-name">Display Name</span>
      <span class="follows-you-badge">Follows you</span>
    </div>
    <div class="user-card-handle">@handle</div>
    <div class="user-card-bio">Bio text...</div>
  </div>
  <div class="user-card-actions">
    <button class="follow-button">Follow</button>
  </div>
</div>
```

### Quoted Post

```html
<div class="quoted-post">
  <div class="quoted-post-header">
    <span class="quoted-post-author">Name</span>
    <span class="quoted-post-handle">@handle</span>
  </div>
  <div class="quoted-post-content">Content...</div>
  <div class="quoted-post-media"><!-- Optional media --></div>
</div>
```

---

## Avatar System

### Size Classes

| Class               | Dimensions | Use Case                     |
| ------------------- | ---------- | ---------------------------- |
| `.avatar-xs`        | 24x24px    | Inline mentions              |
| `.avatar-sm`        | 32x32px    | Compact lists, notifications |
| `.avatar` (default) | 48x48px    | Post cards, user cards       |
| `.avatar-lg`        | 148px      | Profile header               |
| `.avatar-xl`        | 64x64px    | Large displays               |
| `.avatar-2xl`       | 128x128px  | Settings                     |

### Avatar Pattern

```css
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--muted); /* Placeholder color */
}
```

### Zoomable Avatars

Add `media-zoomable` class and data attributes for lightbox support:

```html
<img
  src="..."
  class="avatar media-zoomable"
  data-fullsrc="..."
  data-zoomable="true"
  onclick="event.stopPropagation()"
/>
```

---

## Rich Media Rendering

### Post Media (Images/Videos)

```html
<div class="post-media">
  <img
    src="..."
    class="post-media-item media-zoomable"
    data-fullsrc="..."
    data-zoomable="true"
    alt="Post media"
  />
  <!-- OR -->
  <video src="..." controls class="post-media-item"></video>
</div>
```

**Styles:**

```css
.post-media {
  margin-top: 12px;
  border-radius: 16px;
  overflow: hidden;
}

.post-media-item {
  width: 100%;
  max-height: 500px;
  object-fit: cover;
}
```

### Link Cards (Twitter/Open Graph)

**Structure with image:**

```html
<a href="..." class="link-card" target="_blank" rel="noopener noreferrer">
  <img src="..." class="link-card-image" alt="" />
  <div class="link-card-body">
    <div class="link-card-domain"><svg>...</svg> example.com</div>
    <div class="link-card-title">Page Title</div>
    <div class="link-card-description">Description text...</div>
  </div>
</a>
```

**Small variant (summary card):**

```html
<a href="..." class="link-card link-card-small">
  <img src="..." class="link-card-image" alt="" />
  <div class="link-card-body">...</div>
</a>
```

**Container for lazy loading:**

```html
<div class="link-card-container" data-url="https://..."></div>
```

### YouTube Embeds

Detected automatically from URLs containing `youtube.com/watch?v=` or `youtu.be/`:

```html
<div class="youtube-embed">
  <iframe
    src="https://www.youtube.com/embed/VIDEO_ID"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe>
</div>
```

**Styles:**

```css
.youtube-embed {
  margin-top: 12px;
  border-radius: 16px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}
```

### Loading Link Cards

Use the `loadLinkCards()` function to process `.link-card-container` elements:

```javascript
async function loadLinkCards() {
  const containers = document.querySelectorAll(
    ".link-card-container[data-url]",
  );
  for (const container of containers) {
    const url = container.getAttribute("data-url");

    // Check for YouTube first
    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
      container.innerHTML = renderYouTubeEmbed(youtubeId);
      continue;
    }

    // Fetch unfurl data
    const response = await fetch("/api/unfurl?url=" + encodeURIComponent(url));
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        container.innerHTML = renderLinkCard(result.data, url);
      }
    }
  }
}
```

---

## Shared TypeScript Renderers

### Post Renderer (`src/shared/post-renderer.ts`)

**Configuration Interface:**

```typescript
interface PostRenderConfig {
  showDropdownMenu?: boolean; // Show ... menu
  showInteractiveActions?: boolean; // Enable like/repost/reply
  enableLinkCards?: boolean; // Auto-unfurl URLs
  enableYouTubeEmbeds?: boolean; // Embed YouTube videos
  showRepostIndicator?: boolean; // Show "X reposted" header
  containerId: string; // Target container ID
  currentUserHandle?: string; // For ownership checks
  currentUserId?: string;
}
```

**Usage:**

```typescript
import { getCompletePostScript } from "./shared/post-renderer";

const script = getCompletePostScript({
  containerId: "posts-feed",
  showDropdownMenu: true,
  showInteractiveActions: true,
  enableLinkCards: true,
  currentUserHandle: user.handle,
  currentUserId: user.id,
});
```

### User Renderer (`src/shared/user-renderer.ts`)

```typescript
interface UserCardConfig {
  showFollowButton?: boolean;
  showFollowsYouBadge?: boolean;
  currentUserId?: string;
}
```

### Sidebar Renderer (`src/shared/sidebar-renderer.ts`)

```typescript
interface SidebarConfig {
  activePage?:
    | "home"
    | "explore"
    | "notifications"
    | "profile"
    | "settings"
    | "admin";
  showPostButton?: boolean;
  postButtonOnClick?: string;
  showAdminNav?: boolean;
}
```

---

## Post Actions Pattern

### Action Button Structure

```html
<div class="post-actions">
  <span class="post-action" data-action="reply" data-post-id="123">
    <svg><!-- Reply icon --></svg>
    <span class="reply-count">5</span>
  </span>
  <span class="post-action reposted" data-action="repost" data-post-id="123">
    <svg><!-- Repost icon --></svg>
    <span class="repost-count">12</span>
  </span>
  <span class="post-action liked" data-action="like" data-post-id="123">
    <svg><!-- Heart icon --></svg>
    <span class="like-count">42</span>
  </span>
</div>
```

### Active States

| Class       | Color             | Use               |
| ----------- | ----------------- | ----------------- |
| `.liked`    | `#F91880` (pink)  | User has liked    |
| `.reposted` | `#00BA7C` (green) | User has reposted |

---

## Dropdown Menus

### Post Dropdown Pattern

```html
<div class="post-menu-container">
  <button
    class="post-more-btn"
    onclick="toggleDropdown('123', 'handle', false)"
  >
    <svg><!-- ... icon --></svg>
  </button>
  <div class="post-dropdown" id="dropdown-123">
    <button class="post-dropdown-item">
      <svg>...</svg>
      Follow @handle
    </button>
    <button class="post-dropdown-item destructive">
      <svg>...</svg>
      Block @handle
    </button>
  </div>
</div>

<!-- Backdrop for closing -->
<div class="dropdown-backdrop hidden" id="dropdown-backdrop"></div>
```

### Dropdown Item Variants

- Default: Normal text color
- `.destructive`: Red text, red hover background
- `.follow-btn.following`: Muted color for "Unfollow" state

---

## Form Inputs

### Base Input Style

```css
.input-base {
  width: 100%;
  padding: 0.75rem;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.input-base:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
}
```

### Form Group Pattern

```html
<div class="form-group">
  <label for="email">Email</label>
  <input
    type="email"
    id="email"
    class="input-base"
    placeholder="you@example.com"
  />
  <div class="error" id="email-error"></div>
</div>
```

---

## Navigation Components

### Left Sidebar (`sidebar-renderer.ts`)

```html
<div class="sidebar-left">
  <a href="/home" class="logo">
    <span class="logo-text">The Wire</span>
  </a>
  <a href="/home" class="nav-item active">
    <svg>...</svg>
    <span>Home</span>
  </a>
  <!-- More nav items... -->
  <button class="post-button">Post</button>
</div>
```

### Bottom Nav (Mobile) (`bottom-nav.ts`)

```html
<nav class="bottom-nav" id="bottom-nav">
  <a href="/home" class="bottom-nav-item">
    <svg>...</svg>
  </a>
  <!-- More nav items... -->
</nav>
```

---

## Icons

Use **Lucide icons** (stroke-based SVGs):

```html
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <!-- Path data -->
</svg>
```

Standard sizes:

- Navigation: 24x24 or 28x28
- Post actions: 18x18
- Small inline: 14x14 or 16x16

---

## Best Practices

### DO

1. **Use CSS variables** for all colors, spacing, and radii
2. **Extend base classes** (`.btn-base`, `.card-base`, `.avatar`)
3. **Use semantic class names** (`.btn-danger`, not `.btn-red`)
4. **Include hover and focus states** on all interactive elements
5. **Use `event.stopPropagation()`** on nested clickable elements
6. **Add `data-zoomable="true"`** to images that should be zoomable
7. **Use the shared renderers** for posts and user cards
8. **Match existing patterns** when adding new components

### DON'T

1. **Don't use hardcoded colors** - always use CSS variables
2. **Don't create new button styles** without extending `.btn-base`
3. **Don't skip hover states** on clickable elements
4. **Don't use inline styles** for theming - use data-theme overrides
5. **Don't duplicate rendering logic** - use shared TypeScript modules
6. **Don't forget accessibility** - include alt text, ARIA labels
7. **Don't break theme support** - test across all 6 themes

### Adding New Components

1. Define base styles in CSS with theme variable usage
2. Add theme-specific overrides using `[data-theme='x'] .class`
3. Create TypeScript renderer if component is used across pages
4. Export configuration interface for customization
5. Document in this file

---

## File Reference

| File                             | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `public/css/styles.css`          | Main stylesheet with base components               |
| `src/index.ts` (CSS section)     | Inline CSS with theme overrides                    |
| `src/shared/post-renderer.ts`    | Post card JavaScript generation                    |
| `src/shared/user-renderer.ts`    | User card JavaScript generation                    |
| `src/shared/sidebar-renderer.ts` | Navigation sidebar HTML                            |
| `src/shared/bottom-nav.ts`       | Mobile bottom navigation                           |
| `src/shared/utils.ts`            | Shared utilities (escapeHtml, formatTimeAgo, etc.) |
| `src/handlers/unfurl.ts`         | URL metadata extraction for link cards             |
| `public/js/api.js`               | Client-side API wrapper                            |
