import { ReactNode, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useAuthStore } from "../../stores/authStore";

interface AppLayoutProps {
  children: ReactNode;
  showPostButton?: boolean;
  rightSidebar?: ReactNode;
}

export function AppLayout({
  children,
  showPostButton = true,
  rightSidebar,
}: AppLayoutProps) {
  const user = useAuthStore((s) => s.user);
  const composeRef = useRef<HTMLTextAreaElement>(null);

  const handlePostClick = () => {
    composeRef.current?.focus();
  };

  return (
    <div className="twitter-layout">
      <Sidebar
        showPostButton={showPostButton}
        onPostClick={handlePostClick}
        showAdminNav={user?.isAdmin}
      />

      <main className="main-content">{children}</main>

      {rightSidebar && <aside className="sidebar-right">{rightSidebar}</aside>}

      <BottomNav />
    </div>
  );
}
