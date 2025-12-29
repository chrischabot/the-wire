import { SignIn, SignUp } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

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
    maxWidth: "450px",
  } as React.CSSProperties,
  header: {
    textAlign: "center" as const,
    marginBottom: "24px",
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
};

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "signin";

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logo}>The Wire</div>
          <p style={styles.subtitle}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </p>
        </div>

        {mode === "signup" ? (
          <SignUp
            routing="hash"
            signInUrl="/auth?mode=signin"
            forceRedirectUrl="/post-auth"
          />
        ) : (
          <SignIn
            routing="hash"
            signUpUrl="/auth?mode=signup"
            forceRedirectUrl="/post-auth"
          />
        )}
      </div>
    </div>
  );
}
