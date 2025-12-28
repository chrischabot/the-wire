import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bell, User } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

const styles = {
  nav: {
    position: "fixed" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: "56px",
    background: "var(--background, #fefefe)",
    borderTop: "1px solid var(--border, #e2e8f0)",
    display: "none",
    alignItems: "center",
    justifyContent: "space-around",
    padding: "0 16px",
    zIndex: 50,
  } as React.CSSProperties,
  navItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    color: "var(--foreground, #2d3748)",
    textDecoration: "none",
    transition: "background 0.2s, color 0.2s",
  } as React.CSSProperties,
  navItemActive: {
    color: "var(--primary, #4299e1)",
  } as React.CSSProperties,
  iconWrapper: {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  badge: {
    position: "absolute" as const,
    top: "-4px",
    right: "-4px",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--primary, #4299e1)",
    display: "none",
  } as React.CSSProperties,
};

// CSS for mobile display - injected once
const mobileCSS = `
  @media (max-width: 768px) {
    #bottom-nav {
      display: flex !important;
    }
  }
`;

export function BottomNav() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/home") {
      return location.pathname === "/home" || location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <style>{mobileCSS}</style>
      <nav style={styles.nav} id="bottom-nav">
        <Link
          to="/home"
          style={{
            ...styles.navItem,
            ...(isActive("/home") ? styles.navItemActive : {}),
          }}
        >
          <Home size={24} />
        </Link>

        <Link
          to="/explore"
          style={{
            ...styles.navItem,
            ...(isActive("/explore") ? styles.navItemActive : {}),
          }}
        >
          <Search size={24} />
        </Link>

        <Link
          to="/notifications"
          style={{
            ...styles.navItem,
            ...(isActive("/notifications") ? styles.navItemActive : {}),
          }}
          id="bottom-notifications-nav"
        >
          <span style={styles.iconWrapper}>
            <Bell size={24} />
            <span style={styles.badge} id="bottom-notification-badge" />
          </span>
        </Link>

        <Link
          to={user ? `/u/${user.handle}` : "#"}
          style={{
            ...styles.navItem,
            ...(user && location.pathname === `/u/${user.handle}`
              ? styles.navItemActive
              : {}),
          }}
          id="bottom-profile-nav"
        >
          <User size={24} />
        </Link>
      </nav>
    </>
  );
}
