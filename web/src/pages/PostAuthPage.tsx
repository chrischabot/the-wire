import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useAuthStore } from "../stores/authStore";

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "var(--background)",
  } as React.CSSProperties,
  container: {
    textAlign: "center" as const,
  } as React.CSSProperties,
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid var(--border)",
    borderTopColor: "var(--primary)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 16px",
  } as React.CSSProperties,
  text: {
    color: "var(--muted-foreground)",
    fontSize: "15px",
  } as React.CSSProperties,
  error: {
    color: "#f56565",
    fontSize: "15px",
    marginTop: "16px",
  } as React.CSSProperties,
};

export function PostAuthPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const setLinkStatus = useAuthStore((s) => s.setLinkStatus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      if (!isLoaded) return;

      if (!isSignedIn) {
        navigate("/auth");
        return;
      }

      try {
        const token = await getToken();

        const response = await fetch("/api/clerk/session", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || "Failed to verify session");
          return;
        }

        if (data.data.status === "needs_handle") {
          setLinkStatus("needs_handle");
          navigate("/onboarding/handle");
        } else if (data.data.status === "linked") {
          setUser(data.data.user);
          setLinkStatus("linked");
          navigate("/home");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Session check failed");
      }
    }

    checkSession();
  }, [isLoaded, isSignedIn, getToken, navigate, setUser, setLinkStatus]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.spinner} />
        <p style={styles.text}>Setting up your account...</p>
        {error && <p style={styles.error}>{error}</p>}
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
