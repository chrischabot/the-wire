import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useAuthStore } from "../stores/authStore";
import { Check, X, Loader2 } from "lucide-react";

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
  logoCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "var(--primary)",
    margin: "0 auto 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--primary-foreground)",
    fontSize: "20px",
    fontWeight: 800,
  } as React.CSSProperties,
  title: {
    fontSize: "24px",
    fontWeight: 700,
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
  inputWrapper: {
    position: "relative" as const,
  } as React.CSSProperties,
  inputPrefix: {
    position: "absolute" as const,
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--muted-foreground)",
    fontSize: "16px",
    pointerEvents: "none" as const,
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "12px 40px 12px 24px",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "16px",
    background: "var(--background)",
    color: "var(--foreground)",
    outline: "none",
    transition: "border-color 0.15s ease",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  inputIcon: {
    position: "absolute" as const,
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
  } as React.CSSProperties,
  hint: {
    fontSize: "13px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  available: {
    color: "#10b981",
  } as React.CSSProperties,
  unavailable: {
    color: "#f56565",
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  } as React.CSSProperties,
};

export function HandleOnboardingPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const setLinkStatus = useAuthStore((s) => s.setLinkStatus);
  const linkStatus = useAuthStore((s) => s.linkStatus);

  const [handle, setHandle] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate("/auth");
    }
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (linkStatus === "linked") {
      navigate("/home");
    }
  }, [linkStatus, navigate]);

  const checkHandle = useCallback(async (value: string) => {
    if (value.length < 3) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch(
        `/api/clerk/handles/check?handle=${encodeURIComponent(value)}`,
      );
      const data = await response.json();
      setIsAvailable(data.data?.available ?? false);
    } catch {
      setIsAvailable(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (handle.length >= 3) {
        checkHandle(handle);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [handle, checkHandle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isAvailable) {
      setError("Please choose an available handle");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getToken();

      const response = await fetch("/api/clerk/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ handle }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to complete onboarding");
        return;
      }

      setUser(data.data.user);
      setLinkStatus("linked");
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setHandle(value);
    setIsAvailable(null);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoCircle}>TW</div>
          <div style={styles.title}>Choose your handle</div>
          <p style={styles.subtitle}>
            This is how others will find and mention you
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Handle</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputPrefix}>@</span>
              <input
                type="text"
                value={handle}
                onChange={handleChange}
                placeholder="yourhandle"
                required
                autoFocus
                minLength={3}
                maxLength={15}
                style={{
                  ...styles.input,
                  borderColor:
                    isAvailable === false
                      ? "#f56565"
                      : isAvailable === true
                        ? "#10b981"
                        : undefined,
                }}
              />
              <div style={styles.inputIcon}>
                {isChecking && (
                  <Loader2
                    size={18}
                    style={{
                      color: "var(--muted-foreground)",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
                {!isChecking && isAvailable === true && (
                  <Check size={18} style={{ color: "#10b981" }} />
                )}
                {!isChecking && isAvailable === false && (
                  <X size={18} style={{ color: "#f56565" }} />
                )}
              </div>
            </div>
            <span
              style={{
                ...styles.hint,
                ...(isAvailable === true ? styles.available : {}),
                ...(isAvailable === false ? styles.unavailable : {}),
              }}
            >
              {isAvailable === true && "Handle is available!"}
              {isAvailable === false && "Handle is already taken"}
              {isAvailable === null &&
                "3-15 characters, letters, numbers, underscores"}
            </span>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={isSubmitting || !isAvailable}
            style={{
              ...styles.button,
              opacity: isSubmitting || !isAvailable ? 0.5 : 1,
              cursor: isSubmitting || !isAvailable ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2
                  size={18}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                Creating account...
              </>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
