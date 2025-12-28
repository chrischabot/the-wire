import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../lib/api";
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
    width: "100%",
    maxWidth: "400px",
  } as React.CSSProperties,
  header: {
    textAlign: "center" as const,
    marginBottom: "32px",
  } as React.CSSProperties,
  logo: {
    fontSize: "32px",
    fontWeight: 800,
    color: "var(--foreground)",
    marginBottom: "8px",
  } as React.CSSProperties,
  subtitle: {
    fontSize: "15px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  } as React.CSSProperties,
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as React.CSSProperties,
  label: {
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--foreground)",
  } as React.CSSProperties,
  input: {
    padding: "12px 16px",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "16px",
    background: "var(--background)",
    color: "var(--foreground)",
    outline: "none",
    transition: "border-color 0.15s ease",
  } as React.CSSProperties,
  error: {
    padding: "12px",
    background: "rgba(245, 101, 101, 0.1)",
    color: "#f56565",
    borderRadius: "8px",
    fontSize: "14px",
  } as React.CSSProperties,
  button: {
    padding: "14px",
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    border: "none",
    borderRadius: "9999px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.15s ease",
  } as React.CSSProperties,
  footer: {
    textAlign: "center" as const,
    marginTop: "24px",
    fontSize: "15px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  link: {
    color: "var(--primary)",
    textDecoration: "none",
    fontWeight: 500,
  } as React.CSSProperties,
};

export function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    navigate("/home");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await authApi.login(email, password);
      if (response.success) {
        navigate("/home");
      } else {
        setError(response.error || "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logo}>The Wire</div>
          <p style={styles.subtitle}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              minLength={8}
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.button,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={styles.footer}>
          Don't have an account?{" "}
          <Link to="/signup" style={styles.link}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
