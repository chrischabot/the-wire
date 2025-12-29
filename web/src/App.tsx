import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useAuthStore } from "./stores/authStore";
import { useWebSocket } from "./lib/useWebSocket";
import { setClerkTokenGetter } from "./lib/api";
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
  AuthPage,
  PostAuthPage,
  HandleOnboardingPage,
} from "./pages";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const linkStatus = useAuthStore((s) => s.linkStatus);
  const legacyToken = useAuthStore((s) => s.token);

  if (!isLoaded) {
    return null;
  }

  const isClerkAuth = isSignedIn && linkStatus === "linked" && user;
  const isLegacyAuth = !!legacyToken && !!user;

  if (!isClerkAuth && !isLegacyAuth) {
    return <Navigate to="/auth" replace />;
  }

  if (isSignedIn && linkStatus === "needs_handle") {
    return <Navigate to="/onboarding/handle" replace />;
  }

  return <>{children}</>;
}

function ClerkTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setClerkTokenGetter(getToken);
  }, [getToken]);

  return null;
}

export function App() {
  useWebSocket();

  return (
    <>
      <ClerkTokenBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/post-auth" element={<PostAuthPage />} />
        <Route path="/onboarding/handle" element={<HandleOnboardingPage />} />
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
    </>
  );
}
