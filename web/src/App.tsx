import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { useWebSocket } from "./lib/useWebSocket";
import {
  HomePage,
  ExplorePage,
  NotificationsPage,
  ProfilePage,
  PostPage,
  SettingsPage,
  MutedWordsPage,
  AdminPage,
  LoginPage,
  SignupPage,
  SearchPage,
  FollowListPage,
} from "./pages";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  useWebSocket();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/explore"
        element={
          <ProtectedRoute>
            <ExplorePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/muted"
        element={
          <ProtectedRoute>
            <MutedWordsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        }
      />
      <Route path="/u/:handle" element={<ProfilePage />} />
      <Route path="/u/:handle/followers" element={<FollowListPage />} />
      <Route path="/u/:handle/following" element={<FollowListPage />} />
      <Route path="/post/:id" element={<PostPage />} />
    </Routes>
  );
}
