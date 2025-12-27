/**
 * Shared User Card Rendering Components
 *
 * This module provides reusable JavaScript code for rendering user cards consistently
 * across all pages (search, followers, following).
 */

/**
 * Configuration options for user card rendering
 */
export interface UserCardConfig {
  /** Show the follow button */
  showFollowButton?: boolean;
  /** Show "Follows you" badge */
  showFollowsYouBadge?: boolean;
  /** Current user ID for ownership checks */
  currentUserId?: string;
}

/**
 * Generates the user card renderer JavaScript code
 */
export function getUserCardRendererScript(config: UserCardConfig = {}): string {
  const {
    showFollowButton = true,
    showFollowsYouBadge = true,
    currentUserId = ''
  } = config;

  return `
    // =====================================================
    // USER CARD RENDERER
    // =====================================================

    const userCardConfig = {
      showFollowButton: ${showFollowButton},
      showFollowsYouBadge: ${showFollowsYouBadge},
      currentUserId: '${currentUserId}'
    };

    function renderUserCard(user) {
      const isOwnProfile = userCardConfig.currentUserId && userCardConfig.currentUserId === user.id;
      const avatarHtml = user.avatarUrl
        ? '<img src="' + escapeHtml(user.avatarUrl) + '" class="user-card-avatar media-zoomable" data-fullsrc="' + escapeHtml(user.avatarUrl) + '" data-zoomable="true" alt="" role="button" tabindex="0" onclick="event.stopPropagation()">'
        : '<div class="user-card-avatar user-card-avatar-placeholder"></div>';

      const followsYouBadge = (userCardConfig.showFollowsYouBadge && user.followsCurrentUser)
        ? '<span class="follows-you-badge">Follows you</span>'
        : '';

      const followBtnClass = user.isFollowing ? 'follow-button following' : 'follow-button';
      const followBtnText = user.isFollowing ? 'Following' : 'Follow';

      let followBtn = '';
      if (userCardConfig.showFollowButton && !isOwnProfile) {
        followBtn = '<div class="user-card-actions">' +
          '<button class="' + followBtnClass + '" onclick="event.stopPropagation(); toggleUserFollow(\\'' + user.id + '\\', \\'' + user.handle + '\\', this)">' +
          followBtnText +
          '</button></div>';
      }

      return '<div class="user-card" onclick="window.location.href=\\'/u/' + escapeHtml(user.handle) + '\\'">' +
        avatarHtml +
        '<div class="user-card-content">' +
          '<div class="user-card-header">' +
            '<span class="user-card-name">' + escapeHtml(user.displayName || user.handle) + '</span>' +
            followsYouBadge +
          '</div>' +
          '<div class="user-card-handle">@' + escapeHtml(user.handle) + '</div>' +
          (user.bio ? '<div class="user-card-bio">' + escapeHtml(user.bio) + '</div>' : '') +
        '</div>' +
        followBtn +
      '</div>';
    }

    function renderUserCards(users, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (!users || users.length === 0) {
        container.innerHTML = '<div class="empty-state">No users found.</div>';
        return;
      }

      container.innerHTML = users.map(renderUserCard).join('');
    }

    async function toggleUserFollow(userId, handle, button) {
      const isFollowing = button.classList.contains('following');

      button.disabled = true;
      button.textContent = 'Loading...';

      try {
        const response = await fetch('/api/users/' + handle + '/follow', {
          method: isFollowing ? 'DELETE' : 'POST',
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('auth_token')
          }
        });

        if (response.ok) {
          button.textContent = isFollowing ? 'Follow' : 'Following';
          button.classList.toggle('following', !isFollowing);
        } else {
          button.textContent = isFollowing ? 'Following' : 'Follow';
        }
      } catch (error) {
        console.error('Error toggling follow:', error);
        button.textContent = isFollowing ? 'Following' : 'Follow';
      } finally {
        button.disabled = false;
      }
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  `;
}
