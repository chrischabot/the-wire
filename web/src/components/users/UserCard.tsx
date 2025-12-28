import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { UserProfile } from "../../lib/api";
import { socialApi } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

interface UserCardProps {
  user: UserProfile;
  showFollowButton?: boolean;
  showFollowsYouBadge?: boolean;
}

const styles = {
  card: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    transition: "background 0.15s ease",
  } as React.CSSProperties,
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    objectFit: "cover" as const,
    flexShrink: 0,
    background: "var(--primary)",
  } as React.CSSProperties,
  content: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,
  name: {
    fontWeight: 700,
    fontSize: "15px",
    color: "var(--foreground)",
  } as React.CSSProperties,
  badge: {
    fontSize: "12px",
    color: "var(--muted-foreground)",
    background: "var(--muted)",
    padding: "2px 8px",
    borderRadius: "9999px",
  } as React.CSSProperties,
  handle: {
    fontSize: "14px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  bio: {
    fontSize: "14px",
    color: "var(--foreground)",
    marginTop: "4px",
    lineHeight: 1.4,
  } as React.CSSProperties,
  actions: {
    flexShrink: 0,
  } as React.CSSProperties,
  followBtn: {
    padding: "8px 16px",
    borderRadius: "9999px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
  } as React.CSSProperties,
  followBtnDefault: {
    background: "var(--foreground)",
    color: "var(--background)",
    border: "none",
  } as React.CSSProperties,
  followBtnFollowing: {
    background: "transparent",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
  } as React.CSSProperties,
};

export function UserCard({
  user,
  showFollowButton = true,
  showFollowsYouBadge = true,
}: UserCardProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [isFollowing, setIsFollowing] = useState(user.isFollowing ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isOwnProfile = currentUser?.id === user.id;

  const handleCardClick = () => {
    navigate(`/u/${user.handle}`);
  };

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);

    try {
      if (isFollowing) {
        await socialApi.unfollow(user.handle);
      } else {
        await socialApi.follow(user.handle);
      }
      setIsFollowing(!isFollowing);
    } catch {
      /* intentionally empty */
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        ...styles.card,
        background: isHovered ? "var(--hover)" : "transparent",
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          style={styles.avatar}
          alt=""
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div style={styles.avatar} />
      )}

      <div style={styles.content}>
        <div style={styles.header}>
          <span style={styles.name}>{user.displayName || user.handle}</span>
          {showFollowsYouBadge && user.followsYou && (
            <span style={styles.badge}>Follows you</span>
          )}
        </div>
        <div style={styles.handle}>@{user.handle}</div>
        {user.bio && <div style={styles.bio}>{user.bio}</div>}
      </div>

      {showFollowButton && !isOwnProfile && (
        <div style={styles.actions}>
          <button
            style={{
              ...styles.followBtn,
              ...(isFollowing
                ? styles.followBtnFollowing
                : styles.followBtnDefault),
              opacity: isLoading ? 0.7 : 1,
            }}
            onClick={handleFollowClick}
            disabled={isLoading}
          >
            {isLoading ? "..." : isFollowing ? "Following" : "Follow"}
          </button>
        </div>
      )}
    </div>
  );
}
