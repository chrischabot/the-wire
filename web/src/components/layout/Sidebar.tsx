import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, Search, Bell, User, Settings, Shield } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { notificationsApi } from "../../lib/api";

interface SidebarProps {
  showPostButton?: boolean;
  onPostClick?: () => void;
  showAdminNav?: boolean;
}

export function Sidebar({
  showPostButton = true,
  onPostClick,
  showAdminNav = false,
}: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const { data: unreadData } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.data?.count ?? 0;

  const isActive = (path: string) =>
    location.pathname === path ? " active" : "";

  return (
    <div className="sidebar-left">
      <Link to="/home" className="logo">
        <span className="logo-text">The Wire</span>
      </Link>

      <Link to="/home" className={`nav-item${isActive("/home")}`}>
        <Home size={24} />
        <span>Home</span>
      </Link>

      <Link to="/explore" className={`nav-item${isActive("/explore")}`}>
        <Search size={24} />
        <span>Explore</span>
      </Link>

      {showAdminNav && (
        <Link to="/admin" className={`nav-item${isActive("/admin")}`}>
          <Shield size={24} />
          <span>Admin</span>
        </Link>
      )}

      <Link
        to="/notifications"
        className={`nav-item${isActive("/notifications")}`}
        id="notifications-nav"
      >
        <span className="nav-icon-wrapper">
          <Bell size={24} />
          {unreadCount > 0 && (
            <span
              className="notification-badge show"
              id="notification-badge"
              style={{ background: "var(--primary)" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
        <span>Notifications</span>
      </Link>

      <Link
        to={user ? `/u/${user.handle}` : "#"}
        className={`nav-item${isActive(`/u/${user?.handle}`)}`}
        id="profile-nav"
      >
        <User size={24} />
        <span>Profile</span>
      </Link>

      <Link to="/settings" className={`nav-item${isActive("/settings")}`}>
        <Settings size={24} />
        <span>Settings</span>
      </Link>

      {showPostButton && (
        <button className="post-button" onClick={onPostClick}>
          Post
        </button>
      )}
    </div>
  );
}
