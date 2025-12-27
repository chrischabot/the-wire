/**
 * Shared Sidebar Component
 *
 * Provides reusable sidebar HTML for consistent navigation across all pages.
 */

export interface SidebarConfig {
  /** Currently active nav item: 'home' | 'explore' | 'notifications' | 'profile' | 'settings' | 'admin' */
  activePage?: string;
  /** Show the post button */
  showPostButton?: boolean;
  /** Custom onclick for post button */
  postButtonOnClick?: string;
  /** Show admin nav item (for admin pages) */
  showAdminNav?: boolean;
}

/**
 * Generates the left sidebar HTML
 */
export function getSidebarHtml(config: SidebarConfig = {}): string {
  const {
    activePage = '',
    showPostButton = true,
    postButtonOnClick = "document.getElementById('note-content')?.focus()",
    showAdminNav = false
  } = config;

  const isActive = (page: string) => activePage === page ? ' active' : '';

  const adminNavItem = showAdminNav ? `
      <a href="/admin" class="nav-item${isActive('admin')}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Admin</span>
      </a>` : '';

  return `
    <!-- Left Sidebar -->
    <div class="sidebar-left">
      <a href="/home" class="logo">
        <span class="logo-text">The Wire</span>
      </a>

      <a href="/home" class="nav-item${isActive('home')}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="/explore" class="nav-item${isActive('explore')}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Explore</span>
      </a>${adminNavItem}
      <a href="/notifications" class="nav-item${isActive('notifications')}" id="notifications-nav">
        <span class="nav-icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span class="notification-badge" id="notification-badge"></span>
        </span>
        <span>Notifications</span>
      </a>
      <a href="#" class="nav-item${isActive('profile')}" id="profile-nav">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Profile</span>
      </a>
      <a href="/settings" class="nav-item${isActive('settings')}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Settings</span>
      </a>
      ${showPostButton ? `
      <button class="post-button" onclick="${postButtonOnClick}">Post</button>
      ` : ''}
    </div>`;
}
